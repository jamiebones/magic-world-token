const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MagicWorldGame - Merkle Distribution System", function () {
    let magicWorldGame;
    let magicWorldGems;
    let owner, admin, player1, player2, player3, player4, player5;
    let initialSupply = ethers.parseEther("1000000"); // 1M tokens
    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWT";

    // Helper function to create Merkle tree
    function createMerkleTree(allocations) {
        // Format: [[address, amount], [address, amount], ...]
        // Create leaves using same format as contract: keccak256(abi.encodePacked(address, amount))
        const leaves = allocations.map(([address, amount]) =>
            ethers.solidityPackedKeccak256(["address", "uint256"], [address, amount])
        );
        const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
        return tree;
    }

    // Helper function to get proof for an address
    function getProof(tree, address, amount) {
        const leaf = ethers.solidityPackedKeccak256(["address", "uint256"], [address, amount]);
        return tree.getHexProof(leaf);
    }

    beforeEach(async function () {
        [owner, admin, player1, player2, player3, player4, player5] = await ethers.getSigners();

        // Deploy token contract
        const MagicWorldGems = await ethers.getContractFactory("MagicWorldGems");
        magicWorldGems = await MagicWorldGems.deploy(TOKEN_NAME, TOKEN_SYMBOL, initialSupply);
        await magicWorldGems.waitForDeployment();

        // Deploy game contract
        const MagicWorldGame = await ethers.getContractFactory("MagicWorldGame");
        magicWorldGame = await MagicWorldGame.deploy(await magicWorldGems.getAddress());
        await magicWorldGame.waitForDeployment();

        // Transfer 90% to game contract (900K tokens for vaults)
        const gameAllocation = (initialSupply * 9n) / 10n; // 90%
        await magicWorldGems.transfer(await magicWorldGame.getAddress(), gameAllocation);

        // Initialize vaults
        const partnerAllocation = initialSupply / 10n; // 10%
        await magicWorldGame.initializeVaults(initialSupply, partnerAllocation);

        // Grant GAME_OPERATOR_ROLE to game contract
        const GAME_OPERATOR_ROLE = await magicWorldGems.GAME_OPERATOR_ROLE();
        await magicWorldGems.grantRole(GAME_OPERATOR_ROLE, await magicWorldGame.getAddress());

        // Grant admin role
        await magicWorldGame.grantGameAdminRole(admin.address);
    });

    describe("Setting Merkle Distribution", function () {
        it("Should create a new Merkle distribution with GAME_ADMIN_ROLE", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("100")],
                [player2.address, ethers.parseEther("200")],
                [player3.address, ethers.parseEther("300")]
            ];

            const tree = createMerkleTree(allocations);
            const totalAllocated = ethers.parseEther("600");
            const vaultType = 0; // PLAYER_TASKS
            const durationInDays = 30;

            const merkleRoot = tree.getRoot();

            const tx = await magicWorldGame.connect(admin).setMerkleDistribution(
                merkleRoot,
                totalAllocated,
                vaultType,
                durationInDays
            );

            await expect(tx)
                .to.emit(magicWorldGame, "MerkleDistributionCreated")
                .withArgs(
                    0, // distributionId
                    merkleRoot,
                    totalAllocated,
                    vaultType,
                    await time.latest(),
                    await time.latest() + (durationInDays * 24 * 60 * 60)
                );
        });

        it("Should create a new Merkle distribution with DEFAULT_ADMIN_ROLE", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("100")]
            ];

            const tree = createMerkleTree(allocations);
            const totalAllocated = ethers.parseEther("100");
            const vaultType = 0; // PLAYER_TASKS
            const durationInDays = 7;

            await expect(
                magicWorldGame.connect(owner).setMerkleDistribution(
                    tree.getRoot(),
                    totalAllocated,
                    vaultType,
                    durationInDays
                )
            ).to.not.be.reverted;
        });

        it("Should deduct tokens from vault when creating distribution", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("1000")]
            ];

            const tree = createMerkleTree(allocations);
            const totalAllocated = ethers.parseEther("1000");
            const vaultType = 0; // PLAYER_TASKS

            const vaultBefore = await magicWorldGame.vaults(vaultType);

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                totalAllocated,
                vaultType,
                30
            );

            const vaultAfter = await magicWorldGame.vaults(vaultType);
            expect(vaultAfter.remaining).to.equal(vaultBefore.remaining - totalAllocated);
            expect(vaultAfter.spent).to.equal(vaultBefore.spent + totalAllocated);
        });

        it("Should increment distribution ID for each distribution", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("100")]
            ];

            const tree = createMerkleTree(allocations);
            const totalAllocated = ethers.parseEther("100");

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                totalAllocated,
                0,
                30
            );

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                totalAllocated,
                1, // Different vault
                30
            );

            expect(await magicWorldGame.nextDistributionId()).to.equal(2);
        });

        it("Should reject creation by non-admin", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("100")]
            ];

            const tree = createMerkleTree(allocations);

            await expect(
                magicWorldGame.connect(player1).setMerkleDistribution(
                    tree.getRoot(),
                    ethers.parseEther("100"),
                    0,
                    30
                )
            ).to.be.revertedWith("MWG: Caller is not admin");
        });

        it("Should reject invalid parameters", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("100")]
            ];

            const tree = createMerkleTree(allocations);

            // Invalid merkle root
            await expect(
                magicWorldGame.connect(admin).setMerkleDistribution(
                    ethers.ZeroHash,
                    ethers.parseEther("100"),
                    0,
                    30
                )
            ).to.be.revertedWith("MWG: Invalid merkle root");

            // Zero allocation
            await expect(
                magicWorldGame.connect(admin).setMerkleDistribution(
                    tree.getRoot(),
                    0,
                    0,
                    30
                )
            ).to.be.revertedWith("MWG: Zero allocation");

            // Duration too short
            await expect(
                magicWorldGame.connect(admin).setMerkleDistribution(
                    tree.getRoot(),
                    ethers.parseEther("100"),
                    0,
                    0
                )
            ).to.be.revertedWith("MWG: Duration too short");
        });

        it("Should reject if vault has insufficient balance", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("1000000000")] // Way more than vault has
            ];

            const tree = createMerkleTree(allocations);

            await expect(
                magicWorldGame.connect(admin).setMerkleDistribution(
                    tree.getRoot(),
                    ethers.parseEther("1000000000"),
                    0,
                    30
                )
            ).to.be.revertedWith("MWG: Insufficient vault balance");
        });
    });

    describe("Claiming from Merkle Distribution", function () {
        let tree, distributionId;
        let allocations;

        beforeEach(async function () {
            allocations = [
                [player1.address, ethers.parseEther("100")],
                [player2.address, ethers.parseEther("200")],
                [player3.address, ethers.parseEther("300")]
            ];

            tree = createMerkleTree(allocations);
            const totalAllocated = ethers.parseEther("600");

            const tx = await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                totalAllocated,
                0, // PLAYER_TASKS
                30
            );

            distributionId = 0;
        });

        it("Should allow valid claim with correct proof", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            const balanceBefore = await magicWorldGems.balanceOf(player1.address);

            await magicWorldGame.connect(player1).claimFromMerkle(
                distributionId,
                amount,
                proof
            );

            const balanceAfter = await magicWorldGems.balanceOf(player1.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });

        it("Should emit TokensClaimed event", async function () {
            const amount = ethers.parseEther("200");
            const proof = getProof(tree, player2.address, amount);

            await expect(
                magicWorldGame.connect(player2).claimFromMerkle(
                    distributionId,
                    amount,
                    proof
                )
            )
                .to.emit(magicWorldGame, "TokensClaimed")
                .withArgs(distributionId, player2.address, amount, amount);
        });

        it("Should update claimed amount tracking", async function () {
            const amount = ethers.parseEther("300");
            const proof = getProof(tree, player3.address, amount);

            await magicWorldGame.connect(player3).claimFromMerkle(
                distributionId,
                amount,
                proof
            );

            const claimed = await magicWorldGame.getClaimedAmount(distributionId, player3.address);
            expect(claimed).to.equal(amount);
        });

        it("Should update distribution totalClaimed", async function () {
            const amount1 = ethers.parseEther("100");
            const proof1 = getProof(tree, player1.address, amount1);

            const amount2 = ethers.parseEther("200");
            const proof2 = getProof(tree, player2.address, amount2);

            await magicWorldGame.connect(player1).claimFromMerkle(
                distributionId,
                amount1,
                proof1
            );

            await magicWorldGame.connect(player2).claimFromMerkle(
                distributionId,
                amount2,
                proof2
            );

            const distribution = await magicWorldGame.distributions(distributionId);
            expect(distribution.totalClaimed).to.equal(amount1 + amount2);
        });

        it("Should allow partial claims", async function () {
            // In this system, users claim their full allocation, but we can test
            // that they can't claim more than allocated
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            // First claim (full amount)
            await magicWorldGame.connect(player1).claimFromMerkle(
                distributionId,
                amount,
                proof
            );

            // Try to claim again - should fail
            await expect(
                magicWorldGame.connect(player1).claimFromMerkle(
                    distributionId,
                    amount,
                    proof
                )
            ).to.be.revertedWith("MWG: Nothing to claim");
        });

        it("Should reject invalid proof", async function () {
            const amount = ethers.parseEther("100");
            const wrongProof = getProof(tree, player2.address, ethers.parseEther("200"));

            await expect(
                magicWorldGame.connect(player1).claimFromMerkle(
                    distributionId,
                    amount,
                    wrongProof
                )
            ).to.be.revertedWith("MWG: Invalid proof");
        });

        it("Should reject claim for non-existent distribution", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            await expect(
                magicWorldGame.connect(player1).claimFromMerkle(
                    999, // Non-existent
                    amount,
                    proof
                )
            ).to.be.revertedWith("MWG: Distribution does not exist");
        });

        it("Should reject claim after distribution expires", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            // Fast forward 31 days (distribution is 30 days)
            await time.increase(31 * 24 * 60 * 60);

            await expect(
                magicWorldGame.connect(player1).claimFromMerkle(
                    distributionId,
                    amount,
                    proof
                )
            ).to.be.revertedWith("MWG: Distribution expired");
        });

        it("Should reject claim from finalized distribution", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            // Fast forward past expiration
            await time.increase(31 * 24 * 60 * 60);

            // Finalize distribution
            await magicWorldGame.finalizeDistribution(distributionId);

            await expect(
                magicWorldGame.connect(player1).claimFromMerkle(
                    distributionId,
                    amount,
                    proof
                )
            ).to.be.revertedWith("MWG: Distribution finalized");
        });

        it("Should bypass daily limits (not call _checkDailyLimit)", async function () {
            // Set very low daily limit
            await magicWorldGame.setDailyRewardLimit(ethers.parseEther("1"));

            const amount = ethers.parseEther("100"); // Much higher than limit
            const proof = getProof(tree, player1.address, amount);

            // Should succeed despite exceeding daily limit
            await expect(
                magicWorldGame.connect(player1).claimFromMerkle(
                    distributionId,
                    amount,
                    proof
                )
            ).to.not.be.reverted;
        });

        it("Should work when contract is paused", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            // Pause contract
            await magicWorldGame.pause();

            // Claim should fail when paused
            await expect(
                magicWorldGame.connect(player1).claimFromMerkle(
                    distributionId,
                    amount,
                    proof
                )
            ).to.be.revertedWithCustomError(magicWorldGame, "EnforcedPause");
        });
    });

    describe("Finalizing Distribution", function () {
        let tree, distributionId;
        let allocations;

        beforeEach(async function () {
            allocations = [
                [player1.address, ethers.parseEther("100")],
                [player2.address, ethers.parseEther("200")],
                [player3.address, ethers.parseEther("300")]
            ];

            tree = createMerkleTree(allocations);
            const totalAllocated = ethers.parseEther("600");

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                totalAllocated,
                0, // PLAYER_TASKS
                30
            );

            distributionId = 0;
        });

        it("Should finalize expired distribution", async function () {
            // Fast forward past expiration
            await time.increase(31 * 24 * 60 * 60);

            await expect(
                magicWorldGame.finalizeDistribution(distributionId)
            ).to.not.be.reverted;

            const distribution = await magicWorldGame.distributions(distributionId);
            expect(distribution.finalized).to.be.true;
        });

        it("Should return unclaimed tokens to vault", async function () {
            const amount1 = ethers.parseEther("100");
            const proof1 = getProof(tree, player1.address, amount1);

            // Only player1 claims (100 tokens)
            await magicWorldGame.connect(player1).claimFromMerkle(
                distributionId,
                amount1,
                proof1
            );

            const vaultBefore = await magicWorldGame.vaults(0);

            // Fast forward and finalize
            await time.increase(31 * 24 * 60 * 60);
            await magicWorldGame.finalizeDistribution(distributionId);

            const vaultAfter = await magicWorldGame.vaults(0);

            // Unclaimed: 600 - 100 = 500 tokens should be returned
            const expectedReturn = ethers.parseEther("500");
            expect(vaultAfter.remaining).to.equal(vaultBefore.remaining + expectedReturn);
            expect(vaultAfter.spent).to.equal(vaultBefore.spent - expectedReturn);
        });

        it("Should emit DistributionFinalized event", async function () {
            await time.increase(31 * 24 * 60 * 60);

            await expect(
                magicWorldGame.finalizeDistribution(distributionId)
            )
                .to.emit(magicWorldGame, "DistributionFinalized")
                .withArgs(distributionId, ethers.parseEther("600"), 0);
        });

        it("Should reject finalization before expiration", async function () {
            await expect(
                magicWorldGame.finalizeDistribution(distributionId)
            ).to.be.revertedWith("MWG: Not expired yet");
        });

        it("Should reject double finalization", async function () {
            await time.increase(31 * 24 * 60 * 60);

            await magicWorldGame.finalizeDistribution(distributionId);

            await expect(
                magicWorldGame.finalizeDistribution(distributionId)
            ).to.be.revertedWith("MWG: Already finalized");
        });

        it("Should allow anyone to finalize", async function () {
            await time.increase(31 * 24 * 60 * 60);

            // Non-admin can finalize
            await expect(
                magicWorldGame.connect(player1).finalizeDistribution(distributionId)
            ).to.not.be.reverted;
        });

        it("Should handle finalization when all tokens claimed", async function () {
            // Claim all tokens
            for (let i = 0; i < allocations.length; i++) {
                const [address, amount] = allocations[i];
                const proof = getProof(tree, address, amount);
                const signer = await ethers.getSigner(address);
                await magicWorldGame.connect(signer).claimFromMerkle(
                    distributionId,
                    amount,
                    proof
                );
            }

            const vaultBefore = await magicWorldGame.vaults(0);

            await time.increase(31 * 24 * 60 * 60);
            await magicWorldGame.finalizeDistribution(distributionId);

            const vaultAfter = await magicWorldGame.vaults(0);

            // No tokens to return
            expect(vaultAfter.remaining).to.equal(vaultBefore.remaining);
            expect(vaultAfter.spent).to.equal(vaultBefore.spent);
        });
    });

    describe("View Functions", function () {
        let tree, distributionId;
        let allocations;

        beforeEach(async function () {
            allocations = [
                [player1.address, ethers.parseEther("100")],
                [player2.address, ethers.parseEther("200")]
            ];

            tree = createMerkleTree(allocations);
            const totalAllocated = ethers.parseEther("300");

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                totalAllocated,
                0,
                30
            );

            distributionId = 0;
        });

        it("Should return correct distribution info", async function () {
            const info = await magicWorldGame.getDistributionInfo(distributionId);
            const rootHex = "0x" + tree.getRoot().toString('hex');

            expect(info.merkleRoot).to.equal(rootHex);
            expect(info.totalAllocated).to.equal(ethers.parseEther("300"));
            expect(info.totalClaimed).to.equal(0);
            expect(info.vaultType).to.equal(0);
            expect(info.finalized).to.be.false;
            expect(info.isActive).to.be.true;
            expect(info.unclaimedAmount).to.equal(ethers.parseEther("300"));
        });

        it("Should return claimed amount for user", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            let claimed = await magicWorldGame.getClaimedAmount(distributionId, player1.address);
            expect(claimed).to.equal(0);

            await magicWorldGame.connect(player1).claimFromMerkle(
                distributionId,
                amount,
                proof
            );

            claimed = await magicWorldGame.getClaimedAmount(distributionId, player1.address);
            expect(claimed).to.equal(amount);
        });

        it("Should calculate claimable amount correctly", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            let [claimable, isValid] = await magicWorldGame.getClaimableAmount(
                distributionId,
                player1.address,
                amount,
                proof
            );

            expect(claimable).to.equal(amount);
            expect(isValid).to.be.true;

            // After claiming
            await magicWorldGame.connect(player1).claimFromMerkle(
                distributionId,
                amount,
                proof
            );

            [claimable, isValid] = await magicWorldGame.getClaimableAmount(
                distributionId,
                player1.address,
                amount,
                proof
            );

            expect(claimable).to.equal(0);
            expect(isValid).to.be.true;
        });

        it("Should return false for invalid proof", async function () {
            const amount = ethers.parseEther("100");
            const wrongProof = getProof(tree, player2.address, ethers.parseEther("200"));

            const [claimable, isValid] = await magicWorldGame.getClaimableAmount(
                distributionId,
                player1.address,
                amount,
                wrongProof
            );

            expect(claimable).to.equal(0);
            expect(isValid).to.be.false;
        });

        it("Should return false for expired distribution", async function () {
            const amount = ethers.parseEther("100");
            const proof = getProof(tree, player1.address, amount);

            await time.increase(31 * 24 * 60 * 60);

            const [claimable, isValid] = await magicWorldGame.getClaimableAmount(
                distributionId,
                player1.address,
                amount,
                proof
            );

            expect(claimable).to.equal(0);
            expect(isValid).to.be.false;
        });
    });

    describe("Integration with Existing System", function () {
        it("Should work alongside traditional distributeFromVault", async function () {
            // Create Merkle distribution
            const allocations = [
                [player1.address, ethers.parseEther("100")]
            ];
            const tree = createMerkleTree(allocations);

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                ethers.parseEther("100"),
                0,
                30
            );

            // Also use traditional distribution
            await magicWorldGame.grantDistributorRole(owner.address);
            await magicWorldGame.distributeFromVault(
                0, // PLAYER_TASKS
                [player2.address],
                [ethers.parseEther("50")],
                "Traditional distribution"
            );

            // Both should work
            const proof = getProof(tree, player1.address, ethers.parseEther("100"));
            await magicWorldGame.connect(player1).claimFromMerkle(
                0,
                ethers.parseEther("100"),
                proof
            );

            expect(await magicWorldGems.balanceOf(player1.address)).to.equal(ethers.parseEther("100"));
            expect(await magicWorldGems.balanceOf(player2.address)).to.equal(ethers.parseEther("50"));
        });

        it("Should deduct from same vault correctly", async function () {
            const vaultBefore = await magicWorldGame.vaults(0);

            // Merkle distribution
            const allocations = [[player1.address, ethers.parseEther("100")]];
            const tree = createMerkleTree(allocations);
            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                ethers.parseEther("100"),
                0,
                30
            );

            // Traditional distribution
            await magicWorldGame.grantDistributorRole(owner.address);
            await magicWorldGame.distributeFromVault(
                0,
                [player2.address],
                [ethers.parseEther("50")],
                "Test"
            );

            const vaultAfter = await magicWorldGame.vaults(0);

            // Total deducted: 100 (Merkle) + 50 (Traditional) = 150
            expect(vaultBefore.remaining - vaultAfter.remaining).to.equal(ethers.parseEther("150"));
        });

        it("Merkle claims should not affect player stats (bypass daily limits)", async function () {
            const allocations = [[player1.address, ethers.parseEther("1000")]];
            const tree = createMerkleTree(allocations);

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                ethers.parseEther("1000"),
                0,
                30
            );

            const proof = getProof(tree, player1.address, ethers.parseEther("1000"));
            await magicWorldGame.connect(player1).claimFromMerkle(
                0,
                ethers.parseEther("1000"),
                proof
            );

            // Player stats should not be updated by Merkle claim
            const stats = await magicWorldGame.getPlayerStats(player1.address);
            expect(stats.dailyReceived).to.equal(0); // Not updated by Merkle
            expect(stats.totalEarned).to.equal(0); // Not updated by Merkle
        });

        it("Should support multiple distributions from different vaults", async function () {
            const allocations1 = [[player1.address, ethers.parseEther("100")]];
            const tree1 = createMerkleTree(allocations1);

            const allocations2 = [[player2.address, ethers.parseEther("50")]];
            const tree2 = createMerkleTree(allocations2);

            // Distribution from PLAYER_TASKS vault
            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree1.getRoot(),
                ethers.parseEther("100"),
                0, // PLAYER_TASKS
                30
            );

            // Distribution from SOCIAL_FOLLOWERS vault
            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree2.getRoot(),
                ethers.parseEther("50"),
                1, // SOCIAL_FOLLOWERS
                30
            );

            // Both should be claimable
            const proof1 = getProof(tree1, player1.address, ethers.parseEther("100"));
            await magicWorldGame.connect(player1).claimFromMerkle(0, ethers.parseEther("100"), proof1);

            const proof2 = getProof(tree2, player2.address, ethers.parseEther("50"));
            await magicWorldGame.connect(player2).claimFromMerkle(1, ethers.parseEther("50"), proof2);

            expect(await magicWorldGems.balanceOf(player1.address)).to.equal(ethers.parseEther("100"));
            expect(await magicWorldGems.balanceOf(player2.address)).to.equal(ethers.parseEther("50"));
        });
    });

    describe("Edge Cases", function () {
        it("Should handle single user allocation", async function () {
            const allocations = [[player1.address, ethers.parseEther("1000")]];
            const tree = createMerkleTree(allocations);

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                ethers.parseEther("1000"),
                0,
                30
            );

            const proof = getProof(tree, player1.address, ethers.parseEther("1000"));
            await magicWorldGame.connect(player1).claimFromMerkle(
                0,
                ethers.parseEther("1000"),
                proof
            );

            expect(await magicWorldGems.balanceOf(player1.address)).to.equal(ethers.parseEther("1000"));
        });

        it("Should handle large number of users (gas test)", async function () {
            // Create allocation for 10 users
            const allocations = [];
            for (let i = 0; i < 10; i++) {
                const wallet = ethers.Wallet.createRandom();
                allocations.push([wallet.address, ethers.parseEther("10")]);
            }

            const tree = createMerkleTree(allocations);

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                ethers.parseEther("100"),
                0,
                30
            );

            // Just verify creation works with large tree
            const distribution = await magicWorldGame.distributions(0);
            const rootHex = "0x" + tree.getRoot().toString('hex');
            expect(distribution.merkleRoot).to.equal(rootHex);
        });

        it("Should handle varying allocation amounts", async function () {
            const allocations = [
                [player1.address, ethers.parseEther("0.001")], // Very small
                [player2.address, ethers.parseEther("10000")], // Large
                [player3.address, ethers.parseEther("123.456789")] // Decimal
            ];

            const tree = createMerkleTree(allocations);
            const total = ethers.parseEther("10123.457789");

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                total,
                0,
                30
            );

            // Claim all
            for (const [address, amount] of allocations) {
                const proof = getProof(tree, address, amount);
                const signer = await ethers.getSigner(address);
                await magicWorldGame.connect(signer).claimFromMerkle(0, amount, proof);
                expect(await magicWorldGems.balanceOf(address)).to.equal(amount);
            }
        });

        it("Should handle minimum duration (1 day)", async function () {
            const allocations = [[player1.address, ethers.parseEther("100")]];
            const tree = createMerkleTree(allocations);

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                ethers.parseEther("100"),
                0,
                1 // 1 day
            );

            const distribution = await magicWorldGame.distributions(0);
            expect(distribution.endTime - distribution.startTime).to.equal(86400); // 1 day in seconds
        });

        it("Should handle long duration (365 days)", async function () {
            const allocations = [[player1.address, ethers.parseEther("100")]];
            const tree = createMerkleTree(allocations);

            await magicWorldGame.connect(admin).setMerkleDistribution(
                tree.getRoot(),
                ethers.parseEther("100"),
                0,
                365 // 1 year
            );

            const distribution = await magicWorldGame.distributions(0);
            expect(distribution.endTime - distribution.startTime).to.equal(365 * 86400);
        });
    });
});
