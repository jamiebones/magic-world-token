const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MagicWorldGame - Vault System", function () {
    let magicWorldGame;
    let magicWorldGems;
    let owner, distributor, player1, player2, player3, player4, player5, player6;
    let initialSupply = ethers.parseEther("1000000"); // 1M tokens
    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWT";

    before(async function () {
        [owner, distributor, player1, player2, player3, player4, player5, player6] = await ethers.getSigners();

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

        // Grant distributor role
        await magicWorldGame.grantDistributorRole(distributor.address);
    });

    describe("Vault Initialization", function () {
        it("Should initialize vaults with correct allocations", async function () {
            const totalSupply = initialSupply;
            const partnerAllocation = totalSupply / 10n; // 10%
            const remainingSupply = totalSupply - partnerAllocation; // 90%

            // Check PLAYER_TASKS vault (50% of remaining)
            const playerTasksVault = await magicWorldGame.vaults(0); // AllocationType.PLAYER_TASKS
            expect(playerTasksVault.totalAllocated).to.equal((remainingSupply * 50n) / 100n);
            expect(playerTasksVault.spent).to.equal(0);
            expect(playerTasksVault.remaining).to.equal((remainingSupply * 50n) / 100n);

            // Check SOCIAL_FOLLOWERS vault (5% of remaining)
            const socialFollowersVault = await magicWorldGame.vaults(1); // AllocationType.SOCIAL_FOLLOWERS
            expect(socialFollowersVault.totalAllocated).to.equal((remainingSupply * 5n) / 100n);

            // Check SOCIAL_POSTERS vault (15% of remaining)
            const socialPostersVault = await magicWorldGame.vaults(2); // AllocationType.SOCIAL_POSTERS
            expect(socialPostersVault.totalAllocated).to.equal((remainingSupply * 15n) / 100n);

            // Check ECOSYSTEM_FUND vault (30% of remaining)
            const ecosystemFundVault = await magicWorldGame.vaults(3); // AllocationType.ECOSYSTEM_FUND
            expect(ecosystemFundVault.totalAllocated).to.equal((remainingSupply * 30n) / 100n);
        });

        it("Should emit VaultsInitialized event", async function () {
            // Deploy a fresh contract instance for this test
            const MagicWorldGemsFresh = await ethers.getContractFactory("MagicWorldGems");
            const magicWorldGemsFresh = await MagicWorldGemsFresh.deploy(TOKEN_NAME, TOKEN_SYMBOL, initialSupply);
            await magicWorldGemsFresh.waitForDeployment();

            const MagicWorldGameFresh = await ethers.getContractFactory("MagicWorldGame");
            const magicWorldGameFresh = await MagicWorldGameFresh.deploy(await magicWorldGemsFresh.getAddress());
            await magicWorldGameFresh.waitForDeployment();

            // Transfer tokens to fresh game contract
            const gameAllocation = (initialSupply * 9n) / 10n;
            await magicWorldGemsFresh.transfer(await magicWorldGameFresh.getAddress(), gameAllocation);

            const totalSupply = initialSupply;
            const partnerAllocation = totalSupply / 10n;

            await expect(magicWorldGameFresh.initializeVaults(totalSupply, partnerAllocation))
                .to.emit(magicWorldGameFresh, "VaultsInitialized")
                .withArgs(totalSupply, partnerAllocation);
        });

        it("Should only allow admin to initialize vaults", async function () {
            // Deploy a fresh contract instance for this test
            const MagicWorldGemsFresh = await ethers.getContractFactory("MagicWorldGems");
            const magicWorldGemsFresh = await MagicWorldGemsFresh.deploy(TOKEN_NAME, TOKEN_SYMBOL, initialSupply);
            await magicWorldGemsFresh.waitForDeployment();

            const MagicWorldGameFresh = await ethers.getContractFactory("MagicWorldGame");
            const magicWorldGameFresh = await MagicWorldGameFresh.deploy(await magicWorldGemsFresh.getAddress());
            await magicWorldGameFresh.waitForDeployment();

            // Transfer tokens to fresh game contract
            const gameAllocation = (initialSupply * 9n) / 10n;
            await magicWorldGemsFresh.transfer(await magicWorldGameFresh.getAddress(), gameAllocation);

            await expect(magicWorldGameFresh.connect(distributor).initializeVaults(initialSupply, initialSupply / 10n))
                .to.be.revertedWithCustomError(magicWorldGameFresh, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Vault Distribution", function () {
        const rewardAmount = ethers.parseEther("100");

        describe("distributeFromVault", function () {
            it("Should distribute from PLAYER_TASKS vault", async function () {
                const recipients = [player1.address, player2.address];
                const amounts = [rewardAmount, rewardAmount];

                const vaultType = 0; // PLAYER_TASKS
                const initialVault = await magicWorldGame.vaults(vaultType);

                await expect(magicWorldGame.connect(distributor).distributeFromVault(
                    vaultType, recipients, amounts, "Test distribution"
                ))
                    .to.emit(magicWorldGame, "VaultDistributed")
                    .withArgs(distributor.address, vaultType, recipients, amounts, "Test distribution");

                // Check vault was updated
                const finalVault = await magicWorldGame.vaults(vaultType);
                expect(finalVault.spent).to.equal(initialVault.spent + rewardAmount * 2n);
                expect(finalVault.remaining).to.equal(initialVault.remaining - rewardAmount * 2n);

                // Check players received tokens
                expect(await magicWorldGems.balanceOf(player1.address)).to.equal(rewardAmount);
                expect(await magicWorldGems.balanceOf(player2.address)).to.equal(rewardAmount);
            });

            it("Should reject distribution exceeding vault balance", async function () {
                const vaultType = 0; // PLAYER_TASKS
                const vault = await magicWorldGame.vaults(vaultType);
                const excessiveAmount = vault.remaining + ethers.parseEther("1");

                const recipients = [player1.address];
                const amounts = [excessiveAmount];

                await expect(magicWorldGame.connect(distributor).distributeFromVault(
                    vaultType, recipients, amounts, "Excessive distribution"
                ))
                    .to.be.revertedWith("MWG: Insufficient vault balance");
            });

            it("Should enforce daily limits", async function () {
                const vaultType = 0; // PLAYER_TASKS
                const largeAmount = ethers.parseEther("2000"); // Exceeds daily limit of 1000

                const recipients = [player1.address];
                const amounts = [largeAmount];

                await expect(magicWorldGame.connect(distributor).distributeFromVault(
                    vaultType, recipients, amounts, "Large distribution"
                ))
                    .to.be.revertedWith("MWG: Daily limit exceeded");
            });
        });

        describe("distributeEqualFromVault", function () {
            it("Should distribute equal amounts from vault", async function () {
                const recipients = [player4.address, player5.address, player6.address];
                const amount = rewardAmount;

                const vaultType = 1; // SOCIAL_FOLLOWERS
                const initialVault = await magicWorldGame.vaults(vaultType);
                const totalAmount = amount * BigInt(recipients.length);

                await expect(magicWorldGame.connect(distributor).distributeEqualFromVault(
                    vaultType, recipients, amount, "Equal distribution"
                ))
                    .to.emit(magicWorldGame, "VaultDistributed");

                // Check vault was updated
                const finalVault = await magicWorldGame.vaults(vaultType);
                expect(finalVault.spent).to.equal(initialVault.spent + totalAmount);
                expect(finalVault.remaining).to.equal(initialVault.remaining - totalAmount);

                // Check all players received equal amounts
                for (const recipient of recipients) {
                    expect(await magicWorldGems.balanceOf(recipient)).to.equal(amount);
                }
            });

            it("Should reject when total exceeds vault balance", async function () {
                const vaultType = 1; // SOCIAL_FOLLOWERS
                const vault = await magicWorldGame.vaults(vaultType);
                const excessiveAmount = (vault.remaining / 2n) + ethers.parseEther("1");

                const recipients = [player1.address, player2.address];

                await expect(magicWorldGame.connect(distributor).distributeEqualFromVault(
                    vaultType, recipients, excessiveAmount, "Excessive equal distribution"
                ))
                    .to.be.revertedWith("MWG: Insufficient vault balance");
            });
        });
    });

    describe("Vault Information", function () {
        it("Should return correct vault info", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const [totalAllocated, spent, remaining] = await magicWorldGame.getVaultInfo(vaultType);

            const vault = await magicWorldGame.vaults(vaultType);
            expect(totalAllocated).to.equal(vault.totalAllocated);
            expect(spent).to.equal(vault.spent);
            expect(remaining).to.equal(vault.remaining);
        });

        it("Should return all vault statistics", async function () {
            const [playerTasks, socialFollowers, socialPosters, ecosystemFund] =
                await magicWorldGame.getAllVaultStats();

            expect(playerTasks.totalAllocated).to.be.gt(0);
            expect(socialFollowers.totalAllocated).to.be.gt(0);
            expect(socialPosters.totalAllocated).to.be.gt(0);
            expect(ecosystemFund.totalAllocated).to.be.gt(0);

            // Check total allocation adds up to 100% of remaining supply
            const totalAllocated = playerTasks.totalAllocated +
                socialFollowers.totalAllocated +
                socialPosters.totalAllocated +
                ecosystemFund.totalAllocated;

            const remainingSupply = initialSupply - (initialSupply / 10n); // 90% of initial supply
            expect(totalAllocated).to.equal(remainingSupply);
        });
    });

    describe("Integration with Existing Features", function () {
        it("Should work with daily limits", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const amount = ethers.parseEther("500"); // Within daily limit

            await magicWorldGame.connect(distributor).distributeEqualFromVault(
                vaultType, [player3.address], amount, "Daily reward"
            );

            // Wait for cooldown period to elapse (1 hour default)
            await ethers.provider.send("evm_increaseTime", [3600]);
            await ethers.provider.send("evm_mine");

            // Second distribution should still work (within limits)
            await magicWorldGame.connect(distributor).distributeEqualFromVault(
                vaultType, [player3.address], amount, "Another reward"
            );

            expect(await magicWorldGems.balanceOf(player3.address)).to.equal(amount * 2n);
        });

        it("Should update player statistics", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const amount = ethers.parseEther("100");

            // Wait for cooldown period to elapse
            await ethers.provider.send("evm_increaseTime", [3600]);
            await ethers.provider.send("evm_mine");

            await magicWorldGame.connect(distributor).distributeEqualFromVault(
                vaultType, [player4.address], amount, "Test reward"
            );

            const [dailyReceived, totalEarned, lastReward] = await magicWorldGame.getPlayerStats(player4.address);
            expect(totalEarned).to.equal(amount + ethers.parseEther("100")); // 100 from previous test + 100 from this test
            expect(dailyReceived).to.equal(amount + ethers.parseEther("100"));
        });

        it("Should respect batch size limits", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const recipients = new Array(201).fill(player1.address); // Exceeds max batch size
            const amount = ethers.parseEther("1");

            await expect(magicWorldGame.connect(distributor).distributeEqualFromVault(
                vaultType, recipients, amount, "Large batch"
            ))
                .to.be.revertedWith("MWG: Batch too large");
        });
    });

    describe("Security", function () {
        it("Should only allow distributors to use vault functions", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const recipients = [player1.address];
            const amounts = [ethers.parseEther("100")];

            await expect(magicWorldGame.connect(player1).distributeFromVault(
                vaultType, recipients, amounts, "Unauthorized distribution"
            ))
                .to.be.revertedWithCustomError(magicWorldGame, "AccessControlUnauthorizedAccount");
        });

        it("Should work when contract is paused/unpaused", async function () {
            await magicWorldGame.pause();

            const vaultType = 0; // PLAYER_TASKS
            const recipients = [player1.address];
            const amounts = [ethers.parseEther("100")];

            // Wait for cooldown period to elapse
            await ethers.provider.send("evm_increaseTime", [3600]);
            await ethers.provider.send("evm_mine");

            await expect(magicWorldGame.connect(distributor).distributeFromVault(
                vaultType, recipients, amounts, "Paused distribution"
            ))
                .to.be.revertedWithCustomError(magicWorldGame, "EnforcedPause");

            await magicWorldGame.unpause();

            await expect(magicWorldGame.connect(distributor).distributeFromVault(
                vaultType, recipients, amounts, "Unpaused distribution"
            ))
                .to.emit(magicWorldGame, "VaultDistributed");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero amount distributions", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const recipients = [player1.address];
            const amounts = [0];

            await expect(magicWorldGame.connect(distributor).distributeFromVault(
                vaultType, recipients, amounts, "Zero amount"
            ))
                .to.be.revertedWith("MWG: Zero amount");
        });

        it("Should handle empty recipient arrays", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const recipients = [];
            const amounts = [];

            await expect(magicWorldGame.connect(distributor).distributeFromVault(
                vaultType, recipients, amounts, "Empty arrays"
            ))
                .to.be.revertedWith("MWG: Empty arrays");
        });

        it("Should handle zero address recipients", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const recipients = [ethers.ZeroAddress];
            const amounts = [ethers.parseEther("100")];

            await expect(magicWorldGame.connect(distributor).distributeFromVault(
                vaultType, recipients, amounts, "Zero address"
            ))
                .to.be.revertedWith("MWG: Invalid recipient");
        });

        it("Should handle array length mismatches", async function () {
            const vaultType = 0; // PLAYER_TASKS
            const recipients = [player1.address, player2.address];
            const amounts = [ethers.parseEther("100")]; // Different length

            await expect(magicWorldGame.connect(distributor).distributeFromVault(
                vaultType, recipients, amounts, "Length mismatch"
            ))
                .to.be.revertedWith("MWG: Array length mismatch");
        });
    });
});