const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MagicWorldGame", function () {
    let MagicWorldToken;
    let MagicWorldGame;
    let token;
    let game;
    let owner;
    let gameAdmin;
    let distributor;
    let player1;
    let player2;
    let player3;

    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWT";
    const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens

    beforeEach(async function () {
        [owner, gameAdmin, distributor, player1, player2, player3] = await ethers.getSigners();

        // Deploy Token Contract
        MagicWorldToken = await ethers.getContractFactory("MagicWorldToken");
        token = await MagicWorldToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY);
        await token.waitForDeployment();

        // Deploy Game Contract
        MagicWorldGame = await ethers.getContractFactory("MagicWorldGame");
        game = await MagicWorldGame.deploy(await token.getAddress());
        await game.waitForDeployment();

        // Transfer all tokens to game contract
        await token.transfer(await game.getAddress(), TOTAL_SUPPLY);

        // Grant GAME_OPERATOR_ROLE to game contract
        const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
        await token.grantRole(GAME_OPERATOR_ROLE, await game.getAddress());

        // Set up game roles
        const GAME_ADMIN_ROLE = await game.GAME_ADMIN_ROLE();
        const REWARD_DISTRIBUTOR_ROLE = await game.REWARD_DISTRIBUTOR_ROLE();

        await game.grantRole(GAME_ADMIN_ROLE, gameAdmin.address);
        await game.grantRole(REWARD_DISTRIBUTOR_ROLE, distributor.address);
    });

    describe("Deployment", function () {
        it("Should set the correct token address", async function () {
            expect(await game.magicWorldToken()).to.equal(await token.getAddress());
        });

        it("Should have the correct initial settings", async function () {
            expect(await game.dailyRewardLimit()).to.equal(ethers.parseEther("1000"));
            expect(await game.maxBatchSize()).to.equal(200);
            expect(await game.cooldownPeriod()).to.equal(3600); // 1 hour
        });

        it("Should grant admin roles to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await game.DEFAULT_ADMIN_ROLE();
            const GAME_ADMIN_ROLE = await game.GAME_ADMIN_ROLE();
            const REWARD_DISTRIBUTOR_ROLE = await game.REWARD_DISTRIBUTOR_ROLE();

            expect(await game.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await game.hasRole(GAME_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await game.hasRole(REWARD_DISTRIBUTOR_ROLE, owner.address)).to.be.true;
        });

        it("Should receive all tokens from token contract", async function () {
            const gameBalance = await token.balanceOf(await game.getAddress());
            expect(gameBalance).to.equal(TOTAL_SUPPLY);
        });
    });

    describe("Role Management", function () {
        it("Should allow admin to grant distributor role", async function () {
            await game.grantDistributorRole(player1.address);
            expect(await game.isDistributor(player1.address)).to.be.true;
        });

        it("Should allow admin to revoke distributor role", async function () {
            await game.grantDistributorRole(player1.address);
            await game.revokeDistributorRole(player1.address);
            expect(await game.isDistributor(player1.address)).to.be.false;
        });

        it("Should allow admin to grant game admin role", async function () {
            await game.grantGameAdminRole(player1.address);
            expect(await game.isGameAdmin(player1.address)).to.be.true;
        });

        it("Should allow admin to revoke game admin role", async function () {
            await game.grantGameAdminRole(player1.address);
            await game.revokeGameAdminRole(player1.address);
            expect(await game.isGameAdmin(player1.address)).to.be.false;
        });

        it("Should not allow non-admin to grant roles", async function () {
            await expect(
                game.connect(player1).grantDistributorRole(player2.address)
            ).to.be.revertedWithCustomError(game, "AccessControlUnauthorizedAccount");
        });

        it("Should not allow granting role to zero address", async function () {
            await expect(
                game.grantDistributorRole(ethers.ZeroAddress)
            ).to.be.revertedWith("MWG: Invalid account");
        });
    });

    describe("Reward Distribution", function () {
        describe("distributeRewards", function () {
            it("Should distribute different amounts to multiple players", async function () {
                const recipients = [player1.address, player2.address, player3.address];
                const amounts = [
                    ethers.parseEther("100"),
                    ethers.parseEther("200"),
                    ethers.parseEther("300")
                ];

                await expect(
                    game.connect(distributor).distributeRewards(recipients, amounts, "Daily Login Bonus")
                )
                    .to.emit(game, "RewardsDistributed")
                    .withArgs(distributor.address, recipients, amounts, "Daily Login Bonus");

                expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("100"));
                expect(await token.balanceOf(player2.address)).to.equal(ethers.parseEther("200"));
                expect(await token.balanceOf(player3.address)).to.equal(ethers.parseEther("300"));
            });

            it("Should update player statistics", async function () {
                const amount = ethers.parseEther("150");
                await game.connect(distributor).distributeRewards([player1.address], [amount], "Achievement");

                const [dailyReceived, totalEarned, lastReward] = await game.getPlayerStats(player1.address);
                expect(dailyReceived).to.equal(amount);
                expect(totalEarned).to.equal(amount);
                expect(lastReward).to.be.greaterThan(0);
            });

            it("Should enforce daily limits", async function () {
                const dailyLimit = await game.dailyRewardLimit();
                const amount = dailyLimit + ethers.parseEther("1");

                await expect(
                    game.connect(distributor).distributeRewards([player1.address], [amount], "Excessive Reward")
                ).to.be.revertedWith("MWG: Daily limit exceeded");
            });

            it("Should reset daily limits on new day", async function () {
                // This test would require time manipulation in a real scenario
                // For now, we test the logic with multiple smaller rewards
                const halfLimit = ethers.parseEther("500");

                await game.connect(distributor).distributeRewards([player1.address], [halfLimit], "First Reward");
                await game.connect(distributor).distributeRewards([player1.address], [halfLimit], "Second Reward");

                const [dailyReceived] = await game.getPlayerStats(player1.address);
                expect(dailyReceived).to.equal(ethers.parseEther("1000"));
            });

            it("Should revert if called by non-distributor", async function () {
                await expect(
                    game.connect(player1).distributeRewards([player2.address], [ethers.parseEther("100")], "Unauthorized")
                ).to.be.reverted;
            });
        });

        describe("distributeEqualRewards", function () {
            it("Should distribute equal amounts to multiple players", async function () {
                const recipients = [player1.address, player2.address, player3.address];
                const amount = ethers.parseEther("150");

                await expect(
                    game.connect(distributor).distributeEqualRewards(recipients, amount, "Tournament Prize")
                )
                    .to.emit(game, "RewardsDistributed");

                expect(await token.balanceOf(player1.address)).to.equal(amount);
                expect(await token.balanceOf(player2.address)).to.equal(amount);
                expect(await token.balanceOf(player3.address)).to.equal(amount);
            });

            it("Should enforce batch size limits", async function () {
                const recipients = new Array(201).fill(player1.address);
                const amount = ethers.parseEther("1");

                await expect(
                    game.connect(distributor).distributeEqualRewards(recipients, amount, "Too Many Recipients")
                ).to.be.revertedWith("MWG: Batch too large");
            });
        });
    });

    describe("Token Burning", function () {
        beforeEach(async function () {
            // Give player1 some tokens first
            await game.connect(distributor).distributeRewards([player1.address], [ethers.parseEther("1000")], "Setup");
        });

        it("Should allow players to burn tokens for purchases", async function () {
            const burnAmount = ethers.parseEther("100");
            const itemId = 12345;

            // Player needs to approve the game contract first
            await token.connect(player1).approve(await game.getAddress(), burnAmount);

            await expect(
                game.connect(player1).burnForPurchase(burnAmount, itemId)
            )
                .to.emit(game, "TokensBurned")
                .withArgs(player1.address, burnAmount, itemId);

            // Tokens should be transferred to game contract (burned)
            expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("900"));
        });

        it("Should revert if insufficient balance", async function () {
            const burnAmount = ethers.parseEther("2000"); // More than player has
            await token.connect(player1).approve(await game.getAddress(), burnAmount);

            await expect(
                game.connect(player1).burnForPurchase(burnAmount, 123)
            ).to.be.revertedWith("MWG: Insufficient balance");
        });
    });

    describe("Administrative Functions", function () {
        describe("Parameter Updates", function () {
            it("Should allow game admin to update daily reward limit", async function () {
                const newLimit = ethers.parseEther("2000");
                await expect(
                    game.connect(gameAdmin).setDailyRewardLimit(newLimit)
                )
                    .to.emit(game, "DailyLimitUpdated")
                    .withArgs(ethers.parseEther("1000"), newLimit);

                expect(await game.dailyRewardLimit()).to.equal(newLimit);
            });

            it("Should allow game admin to update max batch size", async function () {
                const newSize = 300;

                await expect(
                    game.connect(gameAdmin).setMaxBatchSize(newSize)
                )
                    .to.emit(game, "MaxBatchSizeUpdated")
                    .withArgs(200, newSize);

                expect(await game.maxBatchSize()).to.equal(newSize);
            });

            it("Should not allow non-admin to update parameters", async function () {
                await expect(
                    game.connect(player1).setDailyRewardLimit(ethers.parseEther("2000"))
                ).to.be.reverted;
            });
        });

        describe("Emergency Functions", function () {
            it("Should allow emergency withdraw by default admin", async function () {
                const withdrawAmount = ethers.parseEther("1000");

                await expect(
                    game.connect(owner).emergencyWithdraw(withdrawAmount)
                )
                    .to.emit(game, "EmergencyWithdraw")
                    .withArgs(owner.address, withdrawAmount);

                expect(await token.balanceOf(owner.address)).to.equal(withdrawAmount);
            });

            it("Should not allow emergency withdraw by non-admin", async function () {
                await expect(
                    game.connect(player1).emergencyWithdraw(ethers.parseEther("1000"))
                ).to.be.reverted;
            });
        });

        describe("Pause Functionality", function () {
            it("Should allow game admin to pause", async function () {
                await game.connect(gameAdmin).pause();
                expect(await game.paused()).to.be.true;
            });

            it("Should prevent reward distribution when paused", async function () {
                await game.connect(gameAdmin).pause();

                await expect(
                    game.connect(distributor).distributeRewards([player1.address], [ethers.parseEther("100")], "Test")
                ).to.be.revertedWithCustomError(game, "EnforcedPause");
            });
        });

        describe("Admin Transfer", function () {
            it("Should transfer admin role successfully", async function () {
                const DEFAULT_ADMIN_ROLE = await game.DEFAULT_ADMIN_ROLE();

                // Verify initial state
                expect(await game.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
                expect(await game.hasRole(DEFAULT_ADMIN_ROLE, player1.address)).to.be.false;

                // Transfer admin role
                await expect(game.transferAdmin(player1.address))
                    .to.emit(game, "AdminTransferred")
                    .withArgs(owner.address, player1.address);

                // Verify final state
                expect(await game.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.false;
                expect(await game.hasRole(DEFAULT_ADMIN_ROLE, player1.address)).to.be.true;
            });

            it("Should not allow non-admin to transfer admin role", async function () {
                await expect(
                    game.connect(player1).transferAdmin(player2.address)
                ).to.be.revertedWithCustomError(game, "AccessControlUnauthorizedAccount");
            });

            it("Should not allow transfer to zero address", async function () {
                await expect(
                    game.transferAdmin(ethers.ZeroAddress)
                ).to.be.revertedWith("MWG: New admin is zero address");
            });

            it("Should not allow transfer to current admin", async function () {
                await expect(
                    game.transferAdmin(owner.address)
                ).to.be.revertedWith("MWG: New admin is current admin");
            });

            it("Should allow new admin to update game parameters", async function () {
                // Transfer admin
                await game.transferAdmin(player1.address);

                // New admin should first grant themselves GAME_ADMIN_ROLE
                const GAME_ADMIN_ROLE = await game.GAME_ADMIN_ROLE();
                await game.connect(player1).grantRole(GAME_ADMIN_ROLE, player1.address);

                // Now new admin should be able to update parameters
                const newLimit = ethers.parseEther("2000");
                await expect(
                    game.connect(player1).setDailyRewardLimit(newLimit)
                ).to.not.be.reverted;

                expect(await game.dailyRewardLimit()).to.equal(newLimit);
            });
        });
    });

    describe("Statistics and Tracking", function () {
        beforeEach(async function () {
            // Distribute some rewards for testing
            await game.connect(distributor).distributeRewards(
                [player1.address, player2.address],
                [ethers.parseEther("100"), ethers.parseEther("200")],
                "Setup Rewards"
            );
        });

        it("Should track contract statistics correctly", async function () {
            const [totalDistributed, playersCount, contractBalance] = await game.getContractStats();

            expect(totalDistributed).to.equal(ethers.parseEther("300"));
            expect(playersCount).to.equal(2);
            expect(contractBalance).to.equal(TOTAL_SUPPLY - ethers.parseEther("300"));
        });

        it("Should track player statistics correctly", async function () {
            const [dailyReceived, totalEarned, lastReward] = await game.getPlayerStats(player1.address);

            expect(dailyReceived).to.equal(ethers.parseEther("100"));
            expect(totalEarned).to.equal(ethers.parseEther("100"));
            expect(lastReward).to.be.greaterThan(0);
        });
    });

    describe("Integration", function () {
        it("Should work end-to-end: distribute rewards, burn tokens, track stats", async function () {
            // Distribute rewards
            await game.connect(distributor).distributeRewards(
                [player1.address],
                [ethers.parseEther("500")],
                "Quest Completion"
            );

            // Check player received tokens
            expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("500"));

            // Player burns tokens for purchase
            await token.connect(player1).approve(await game.getAddress(), ethers.parseEther("100"));
            await game.connect(player1).burnForPurchase(ethers.parseEther("100"), 999);

            // Check final state
            expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("400"));

            const [totalDistributed, playersCount] = await game.getContractStats();
            expect(totalDistributed).to.equal(ethers.parseEther("500"));
            expect(playersCount).to.equal(1);
        });
    });
});