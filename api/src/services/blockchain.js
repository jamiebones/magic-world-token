const { ethers } = require('ethers');
const logger = require('../utils/logger');

// Import contract ABIs 
const MagicWorldTokenABI = require('../../contracts/MagicWorldToken.json').abi;
const MagicWorldGameABI = require('../../contracts/MagicWorldGame.json').abi;

class BlockchainService {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.tokenContract = null;
        this.gameContract = null;
        this.isInitialized = false;
    }

    /**
     * Initialize blockchain connection and contracts
     */
    async initialize() {
        try {
            // Debug: Check private key
            const privateKey = process.env.PRIVATE_KEY;
            logger.info(`🔑 Private key length: ${privateKey ? privateKey.length : 'undefined'}`);
            logger.info(`🔑 Private key starts with: ${privateKey ? privateKey.substring(0, 4) + '...' : 'undefined'}`);

            // Setup provider
            this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

            // Setup wallet
            this.wallet = new ethers.Wallet(privateKey, this.provider);

            // Initialize contracts
            this.tokenContract = new ethers.Contract(
                process.env.TOKEN_CONTRACT_ADDRESS,
                MagicWorldTokenABI,
                this.wallet
            );

            this.gameContract = new ethers.Contract(
                process.env.GAME_CONTRACT_ADDRESS,
                MagicWorldGameABI,
                this.wallet
            );

            // Verify connection
            const network = await this.provider.getNetwork();
            const balance = await this.provider.getBalance(this.wallet.address);

            logger.info(`🔗 Blockchain initialized - Network: ${network.name} (${network.chainId})`);
            logger.info(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

            this.isInitialized = true;
            return true;
        } catch (error) {
            logger.error('Failed to initialize blockchain service:', error);
            throw new Error(`Blockchain initialization failed: ${error.message}`);
        }
    }

    /**
     * Ensure service is initialized
     */
    _ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('Blockchain service not initialized. Call initialize() first.');
        }
    }

    /**
     * Get player's token balance
     * @param {string} playerAddress - Player's wallet address
     * @returns {Promise<string>} Balance in tokens (formatted)
     */
    async getPlayerBalance(playerAddress) {
        this._ensureInitialized();

        try {
            const balance = await this.tokenContract.balanceOf(playerAddress);
            return ethers.formatEther(balance);
        } catch (error) {
            logger.error(`Failed to get balance for ${playerAddress}:`, error);
            throw new Error(`Failed to get player balance: ${error.message}`);
        }
    }

    /**
     * Distribute different amounts to multiple players
     * @param {Array<string>} recipients - Array of player addresses
     * @param {Array<string>} amounts - Array of token amounts (in tokens, not wei)
     * @param {string} reason - Reason for distribution (for logging)
     * @returns {Promise<Object>} Transaction result
     */
    async distributeRewards(recipients, amounts, reason = 'Token Distribution') {
        this._ensureInitialized();
        try {
            // Validate inputs
            if (!Array.isArray(recipients) || !Array.isArray(amounts)) {
                throw new Error('Recipients and amounts must be arrays');
            }

            if (recipients.length !== amounts.length) {
                throw new Error('Recipients and amounts arrays must have the same length');
            }

            if (recipients.length === 0) {
                throw new Error('Cannot distribute to empty recipient list');
            }

            const maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE) || 200;
            if (recipients.length > maxBatchSize) {
                throw new Error(`Batch size ${recipients.length} exceeds maximum ${maxBatchSize}`);
            }

            // Convert amounts to wei
            const amountsInWei = amounts.map(amount => ethers.parseEther(amount.toString()));

            // Validate addresses
            recipients.forEach(address => {
                if (!ethers.isAddress(address)) {
                    throw new Error(`Invalid address: ${address}`);
                }
            });

            logger.info(`🎁 Distributing tokens to ${recipients.length} players - Reason: ${reason}`);

            // Execute transaction
            const tx = await this.gameContract.distributeRewards(recipients, amountsInWei, reason);

            logger.info(`📝 Transaction submitted: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();

            logger.info(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                recipients: recipients.length,
                totalAmount: amounts.reduce((sum, amount) => sum + parseFloat(amount), 0).toString(),
                reason
            };

        } catch (error) {
            logger.error('Failed to distribute rewards:', error);
            throw new Error(`Failed to distribute rewards: ${error.message}`);
        }
    }

    /**
     * Distribute equal amounts to multiple players (more gas efficient)
     * @param {Array<string>} recipients - Array of player addresses
     * @param {string} amount - Token amount per player (in tokens, not wei)
     * @param {string} reason - Reason for distribution
     * @returns {Promise<Object>} Transaction result
     */
    async distributeEqualRewards(recipients, amount, reason = 'Equal Token Distribution') {
        this._ensureInitialized();

        try {
            // Validate inputs
            if (!Array.isArray(recipients)) {
                throw new Error('Recipients must be an array');
            }

            if (recipients.length === 0) {
                throw new Error('Cannot distribute to empty recipient list');
            }

            const maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE) || 200;
            if (recipients.length > maxBatchSize) {
                throw new Error(`Batch size ${recipients.length} exceeds maximum ${maxBatchSize}`);
            }

            // Convert amount to wei
            const amountInWei = ethers.parseEther(amount.toString());

            // Validate addresses
            recipients.forEach(address => {
                if (!ethers.isAddress(address)) {
                    throw new Error(`Invalid address: ${address}`);
                }
            });

            logger.info(`🎁 Distributing ${amount} tokens each to ${recipients.length} players - Reason: ${reason}`);

            // Execute transaction
            const tx = await this.gameContract.distributeEqualRewards(recipients, amountInWei, reason);

            logger.info(`📝 Transaction submitted: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();

            logger.info(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

            const totalAmount = (parseFloat(amount) * recipients.length).toString();

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                recipients: recipients.length,
                amountPerPlayer: amount,
                totalAmount,
                reason
            };

        } catch (error) {
            logger.error('Failed to distribute equal rewards:', error);
            throw new Error(`Failed to distribute equal rewards: ${error.message}`);
        }
    }

    /**
     * Get player statistics
     * @param {string} playerAddress - Player's wallet address
     * @returns {Promise<Object>} Player stats
     */
    async getPlayerStats(playerAddress) {
        this._ensureInitialized();

        try {
            if (!ethers.isAddress(playerAddress)) {
                throw new Error(`Invalid address: ${playerAddress}`);
            }
            const [dailyReceived, totalEarned, lastReward] = await this.gameContract.getPlayerStats(playerAddress);
            return {
                playerAddress,
                dailyReceived: ethers.formatEther(dailyReceived),
                totalEarned: ethers.formatEther(totalEarned),
                lastReward: new Date(Number(lastReward) * 1000).toISOString(),
                currentBalance: await this.getPlayerBalance(playerAddress)
            };
        } catch (error) {
            logger.error(`Failed to get stats for ${playerAddress}:`, error);
            throw new Error(`Failed to get player stats: ${error.message}`);
        }
    }

    /**
     * Get contract statistics
     * @returns {Promise<Object>} Contract stats
     */
    async getContractStats() {
        this._ensureInitialized();

        try {
            const [totalDistributed, playersCount, contractBalance] = await this.gameContract.getContractStats();
            return {
                totalDistributed: ethers.formatEther(totalDistributed),
                uniquePlayers: playersCount.toString(),
                contractBalance: ethers.formatEther(contractBalance),
                tokenContractAddress: process.env.TOKEN_CONTRACT_ADDRESS,
                gameContractAddress: process.env.GAME_CONTRACT_ADDRESS
            };

        } catch (error) {
            logger.error('Failed to get contract stats:', error);
            throw new Error(`Failed to get contract stats: ${error.message}`);
        }
    }

    /**
     * Check if a transaction was successful
     * @param {string} txHash - Transaction hash
     * @returns {Promise<Object>} Transaction status
     */
    async getTransactionStatus(txHash) {
        this._ensureInitialized();
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);

            if (!receipt) {
                return {
                    status: 'pending',
                    message: 'Transaction not yet mined'
                };
            }

            return {
                status: receipt.status === 1 ? 'success' : 'failed',
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                transactionHash: txHash
            };

        } catch (error) {
            logger.error(`Failed to get transaction status for ${txHash}:`, error);
            throw new Error(`Failed to get transaction status: ${error.message}`);
        }
    }

    /**
     * Estimate gas for a transaction
     * @param {string} method - Contract method name
     * @param {Array} params - Method parameters
     * @returns {Promise<Object>} Gas estimation
     */
    async estimateGas(method, params) {
        this._ensureInitialized();

        try {
            let gasEstimate;

            if (method === 'distributeRewards') {
                gasEstimate = await this.gameContract.distributeRewards.estimateGas(...params);
            } else if (method === 'distributeEqualRewards') {
                gasEstimate = await this.gameContract.distributeEqualRewards.estimateGas(...params);
            } else {
                throw new Error(`Unknown method: ${method}`);
            }

            const gasPrice = await this.provider.getFeeData();
            const estimatedCost = gasEstimate * gasPrice.gasPrice;

            return {
                gasEstimate: gasEstimate.toString(),
                gasPrice: ethers.formatUnits(gasPrice.gasPrice, 'gwei'),
                estimatedCostETH: ethers.formatEther(estimatedCost),
                estimatedCostUSD: 'N/A' // Would need price oracle
            };

        } catch (error) {
            logger.error('Failed to estimate gas:', error);
            throw new Error(`Failed to estimate gas: ${error.message}`);
        }
    }
}

// Export singleton instance
const blockchainService = new BlockchainService();
module.exports = blockchainService;