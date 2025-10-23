const { ethers } = require('ethers');
const MerkleTreeBuilder = require('../../utils/merkleTreeBuilder');
const MerkleDistribution = require('../../models/MerkleDistribution');
const MerkleLeaf = require('../../models/MerkleLeaf');
const logger = require('../../utils/logger');

// Import contract ABI
const MagicWorldGameABI = require('../../../contracts/MagicWorldGame.json').abi;

/**
 * MerkleDistributionService
 * Manages Merkle-based token distributions
 * Integrates with blockchain and database
 */
class MerkleDistributionService {
    constructor(provider, wallet, gameContractAddress) {
        this.provider = provider;
        this.wallet = wallet;
        this.gameContract = new ethers.Contract(
            gameContractAddress,
            MagicWorldGameABI,
            wallet
        );
    }

    /**
     * Create a new Merkle distribution
     * @param {Array} allocations - Array of {address, amount} objects
     * @param {string} vaultType - Vault type enum string
     * @param {number} durationInDays - Duration in days
     * @param {Object} metadata - Distribution metadata
     * @param {string} creatorAddress - Address of admin creating distribution
     * @returns {Promise<Object>} Created distribution with tree data
     */
    async createDistribution(allocations, vaultType, durationInDays, metadata, creatorAddress) {
        try {
            logger.info(`Creating Merkle distribution for ${allocations.length} recipients from ${vaultType} vault`);

            // Validate allocations
            const validation = MerkleTreeBuilder.validateAllocations(allocations);
            if (!validation.valid) {
                throw new Error(`Invalid allocations: ${validation.errors.join(', ')}`);
            }

            // Build Merkle tree
            const { tree, root, leaves, leafMap, totalAllocated } = MerkleTreeBuilder.buildTree(allocations);
            const stats = MerkleTreeBuilder.getTreeStats({ leaves, root, totalAllocated });

            logger.info(`Merkle tree built - Root: ${root}, Recipients: ${stats.recipientCount}`);

            // Convert vault type string to enum value
            const vaultTypeEnum = this._getVaultTypeEnum(vaultType);

            // Check vault balance
            await this._checkVaultBalance(vaultTypeEnum, totalAllocated);

            // Call contract to create distribution
            logger.info(`Calling setMerkleDistribution on-chain...`);
            logger.info(`Parameters: root=${root}, totalAllocated=${totalAllocated}, vaultTypeEnum=${vaultTypeEnum}, durationInDays=${durationInDays}`);
            const tx = await this.gameContract.setMerkleDistribution(
                root,
                totalAllocated,
                vaultTypeEnum,
                durationInDays
            );

            logger.info(`Transaction sent: ${tx.hash}, waiting for confirmation...`);
            const receipt = await tx.wait();
            logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

            // Extract distribution ID from event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.gameContract.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed.name === 'MerkleDistributionCreated';
                } catch {
                    return false;
                }
            });

            if (!event) {
                throw new Error('MerkleDistributionCreated event not found in transaction receipt');
            }

            const parsedEvent = this.gameContract.interface.parseLog({
                topics: event.topics,
                data: event.data
            });

            const distributionId = Number(parsedEvent.args.distributionId);
            const startTime = new Date(Number(parsedEvent.args.startTime) * 1000);
            const endTime = new Date(Number(parsedEvent.args.endTime) * 1000);

            logger.info(`Distribution created on-chain with ID: ${distributionId}`);

            // Save distribution to database
            const distribution = new MerkleDistribution({
                distributionId,
                merkleRoot: root,
                totalAllocated,
                totalClaimed: '0',
                startTime,
                endTime,
                vaultType,
                finalized: false,
                title: metadata.title || `Distribution #${distributionId}`,
                description: metadata.description || '',
                recipientCount: stats.recipientCount,
                creationTxHash: tx.hash,
                createdBy: creatorAddress.toLowerCase(),
                tags: metadata.tags || [],
                status: 'pending',
            });

            await distribution.save();
            logger.info(`Distribution saved to database`);

            // Save leaves to database
            const leafDocuments = leaves.map(leaf => ({
                distributionId,
                userAddress: leaf.address,
                allocatedAmount: leaf.amount,
                leafHash: leaf.leafHash,
                leafIndex: leaf.leafIndex,
                fullyClaimed: false,
                claimedAmount: '0',
                claimCount: 0,
                metadata: {
                    reason: metadata.title,
                    category: metadata.category || 'general',
                },
            }));

            await MerkleLeaf.insertMany(leafDocuments);
            logger.info(`${leafDocuments.length} leaves saved to database`);

            return {
                distribution: distribution.toObject(),
                stats,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
            };

        } catch (error) {
            logger.error('Failed to create Merkle distribution:', error);
            throw error;
        }
    }

    /**
     * Get Merkle proof for a user
     * @param {number} distributionId - Distribution ID
     * @param {string} userAddress - User address
     * @returns {Promise<Object>} Proof data
     */
    async getProof(distributionId, userAddress) {
        try {
            // Get user's leaf from database
            const leaf = await MerkleLeaf.findUserLeaf(distributionId, userAddress);

            if (!leaf) {
                return {
                    eligible: false,
                    message: 'Address not found in this distribution',
                };
            }

            // Get all leaves for this distribution to rebuild tree
            const allLeaves = await MerkleLeaf.findByDistribution(distributionId);

            // Rebuild tree
            const leafHashes = allLeaves
                .sort((a, b) => a.leafIndex - b.leafIndex)
                .map(l => l.leafHash);

            const { MerkleTree } = require('merkletreejs');
            const keccak256 = require('keccak256');

            const tree = new MerkleTree(leafHashes, keccak256, {
                sortPairs: true,
                hashLeaves: false,
            });

            // Generate proof
            const proof = tree.getHexProof(leaf.leafHash);

            return {
                eligible: true,
                proof,
                allocatedAmount: leaf.allocatedAmount,
                claimedAmount: leaf.claimedAmount,
                unclaimedAmount: leaf.unclaimedAmount,
                leafHash: leaf.leafHash,
            };

        } catch (error) {
            logger.error(`Failed to get proof for ${userAddress}:`, error);
            throw error;
        }
    }

    /**
     * Check user's claimable amount
     * @param {number} distributionId - Distribution ID
     * @param {string} userAddress - User address
     * @returns {Promise<Object>} Claimable info
     */
    async getClaimableAmount(distributionId, userAddress) {
        try {
            const distribution = await MerkleDistribution.findOne({ distributionId });

            if (!distribution) {
                throw new Error(`Distribution ${distributionId} not found`);
            }

            const leaf = await MerkleLeaf.findUserLeaf(distributionId, userAddress);

            if (!leaf) {
                return {
                    eligible: false,
                    claimable: '0',
                    message: 'Address not in this distribution',
                };
            }

            if (distribution.finalized) {
                return {
                    eligible: false,
                    claimable: '0',
                    message: 'Distribution has been finalized',
                };
            }

            if (new Date() >= distribution.endTime) {
                return {
                    eligible: false,
                    claimable: '0',
                    message: 'Distribution has expired',
                };
            }

            if (new Date() < distribution.startTime) {
                return {
                    eligible: false,
                    claimable: '0',
                    message: 'Distribution has not started yet',
                    startTime: distribution.startTime,
                };
            }

            const allocated = BigInt(leaf.allocatedAmount);
            const claimed = BigInt(leaf.claimedAmount);
            const claimable = allocated - claimed;

            return {
                eligible: claimable > 0n,
                claimable: claimable.toString(),
                allocatedAmount: leaf.allocatedAmount,
                claimedAmount: leaf.claimedAmount,
                fullyClaimed: leaf.fullyClaimed,
                lastClaimTime: leaf.lastClaimTime,
                claimCount: leaf.claimCount,
            };

        } catch (error) {
            logger.error(`Failed to get claimable amount:`, error);
            throw error;
        }
    }

    /**
     * Get all distributions for a user
     * @param {string} userAddress - User address
     * @returns {Promise<Array>} User's distributions
     */
    async getUserDistributions(userAddress) {
        try {
            const leaves = await MerkleLeaf.findUserDistributions(userAddress);

            const distributionIds = [...new Set(leaves.map(l => l.distributionId))];
            const distributions = await MerkleDistribution.find({
                distributionId: { $in: distributionIds }
            });

            // Combine distribution info with user's leaf data
            const result = distributions.map(dist => {
                const leaf = leaves.find(l => l.distributionId === dist.distributionId);
                return {
                    distribution: dist.toObject(),
                    userAllocation: {
                        allocatedAmount: leaf.allocatedAmount,
                        claimedAmount: leaf.claimedAmount,
                        unclaimedAmount: leaf.unclaimedAmount,
                        fullyClaimed: leaf.fullyClaimed,
                        claimCount: leaf.claimCount,
                        lastClaimTime: leaf.lastClaimTime,
                    },
                };
            });

            return result;

        } catch (error) {
            logger.error(`Failed to get user distributions:`, error);
            throw error;
        }
    }

    /**
     * Sync distribution from blockchain
     * @param {number} distributionId - Distribution ID
     * @returns {Promise<Object>} Updated distribution
     */
    async syncDistribution(distributionId) {
        try {
            logger.info(`Syncing distribution ${distributionId} from blockchain`);

            const distribution = await MerkleDistribution.findOne({ distributionId });
            if (!distribution) {
                throw new Error(`Distribution ${distributionId} not found in database`);
            }

            // Get on-chain data
            const chainData = await this.gameContract.getDistributionInfo(distributionId);

            // Update distribution
            distribution.totalClaimed = chainData.totalClaimed.toString();
            distribution.finalized = chainData.finalized;
            distribution.updateStatus();

            await distribution.save();
            logger.info(`Distribution ${distributionId} synced - Status: ${distribution.status}`);

            return distribution.toObject();

        } catch (error) {
            logger.error(`Failed to sync distribution ${distributionId}:`, error);
            throw error;
        }
    }

    /**
     * Finalize an expired distribution
     * @param {number} distributionId - Distribution ID
     * @returns {Promise<Object>} Transaction result
     */
    async finalizeDistribution(distributionId) {
        try {
            logger.info(`Finalizing distribution ${distributionId}`);

            const distribution = await MerkleDistribution.findOne({ distributionId });
            if (!distribution) {
                throw new Error(`Distribution ${distributionId} not found`);
            }

            if (distribution.finalized) {
                throw new Error('Distribution already finalized');
            }

            if (new Date() < distribution.endTime) {
                throw new Error('Distribution has not expired yet');
            }

            // Call contract
            const tx = await this.gameContract.finalizeDistribution(distributionId);
            logger.info(`Finalization transaction sent: ${tx.hash}`);

            const receipt = await tx.wait();
            logger.info(`Distribution finalized in block ${receipt.blockNumber}`);

            // Update database
            distribution.finalized = true;
            distribution.finalizationTxHash = tx.hash;
            distribution.updateStatus();
            await distribution.save();

            // Sync claimed amounts
            await this.syncDistribution(distributionId);

            return {
                distributionId,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                distribution: distribution.toObject(),
            };

        } catch (error) {
            logger.error(`Failed to finalize distribution:`, error);
            throw error;
        }
    }

    /**
     * Get distribution statistics
     * @param {number} distributionId - Distribution ID
     * @returns {Promise<Object>} Statistics
     */
    async getDistributionStats(distributionId) {
        try {
            const distribution = await MerkleDistribution.findOne({ distributionId });
            if (!distribution) {
                throw new Error(`Distribution ${distributionId} not found`);
            }

            const leafStats = await MerkleLeaf.getDistributionStats(distributionId);

            const totalAllocated = BigInt(distribution.totalAllocated);
            const totalClaimed = BigInt(distribution.totalClaimed);
            const unclaimedAmount = totalAllocated - totalClaimed;

            const claimRate = totalAllocated > 0n
                ? Number((totalClaimed * 100n) / totalAllocated)
                : 0;

            return {
                distributionId,
                status: distribution.status,
                totalAllocated: distribution.totalAllocated,
                totalClaimed: distribution.totalClaimed,
                unclaimedAmount: unclaimedAmount.toString(),
                claimRate: claimRate.toFixed(2) + '%',
                recipientCount: distribution.recipientCount,
                claimedCount: leafStats.claimedCount,
                fullyClaimedCount: leafStats.fullyClaimedCount,
                totalClaims: leafStats.totalClaims,
                startTime: distribution.startTime,
                endTime: distribution.endTime,
                finalized: distribution.finalized,
            };

        } catch (error) {
            logger.error(`Failed to get distribution stats:`, error);
            throw error;
        }
    }

    /**
     * List all distributions with optional filters
     * @param {Object} filters - Query filters
     * @returns {Promise<Array>} Distributions
     */
    async listDistributions(filters = {}) {
        try {
            const query = {};

            if (filters.status) {
                query.status = filters.status;
            }

            if (filters.vaultType) {
                query.vaultType = filters.vaultType;
            }

            if (filters.createdBy) {
                query.createdBy = filters.createdBy.toLowerCase();
            }

            const distributions = await MerkleDistribution.find(query)
                .sort({ createdAt: -1 })
                .limit(filters.limit || 100);

            return distributions.map(d => d.toObject());

        } catch (error) {
            logger.error('Failed to list distributions:', error);
            throw error;
        }
    }

    /**
     * Helper: Convert vault type string to enum value
     */
    _getVaultTypeEnum(vaultType) {
        const vaultMap = {
            'PLAYER_TASKS': 0,
            'SOCIAL_FOLLOWERS': 1,
            'SOCIAL_POSTERS': 2,
            'ECOSYSTEM_FUND': 3,
        };

        const enumValue = vaultMap[vaultType];
        if (enumValue === undefined) {
            throw new Error(`Invalid vault type: ${vaultType}`);
        }

        return enumValue;
    }

    /**
     * Helper: Check vault balance
     */
    async _checkVaultBalance(vaultTypeEnum, requiredAmount) {
        const vaultInfo = await this.gameContract.getVaultInfo(vaultTypeEnum);
        const remaining = vaultInfo.remaining;

        if (remaining < BigInt(requiredAmount)) {
            throw new Error(
                `Insufficient vault balance. Required: ${requiredAmount}, Available: ${remaining.toString()}`
            );
        }
    }
}

module.exports = MerkleDistributionService;
