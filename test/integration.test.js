const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Integration Tests", function () {
    let MagicWorldToken;
    let MagicWorldGame;
    let token;
    let game;
    let owner;
    let gameAdmin;
    let distributor;
    let players;

    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWT";
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");

    beforeEach(async function () {
        const signers = await ethers.getSigners();
        [owner, gameAdmin, distributor, ...players] = signers;

        // Deploy contracts
        MagicWorldToken = await ethers.getContractFactory("MagicWorldToken");
        token = await MagicWorldToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY);
        await token.waitForDeployment();

        MagicWorldGame = await ethers.getContractFactory("MagicWorldGame");
        game = await MagicWorldGame.deploy(await token.getAddress());
        await game.waitForDeployment();

        // Complete setup as described in deployment pattern
        await token.transfer(await game.getAddress(), TOTAL_SUPPLY);

        const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
        await token.grantRole(GAME_OPERATOR_ROLE, await game.getAddress());

        const GAME_ADMIN_ROLE = await game.GAME_ADMIN_ROLE();
        const REWARD_DISTRIBUTOR_ROLE = await game.REWARD_DISTRIBUTOR_ROLE();

        await game.grantRole(GAME_ADMIN_ROLE, gameAdmin.address);
        await game.grantRole(REWARD_DISTRIBUTOR_ROLE, distributor.address);
    });

    describe("Complete Deployment Flow", function () {
        it("Should follow the deployment pattern correctly", async function () {
            // 1. Token contract deployed with fixed supply ✓
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);

            // 2. Game contract deployed with token address ✓
            expect(await game.magicWorldToken()).to.equal(await token.getAddress());

            // 3. All tokens transferred to game contract ✓
            expect(await token.balanceOf(await game.getAddress())).to.equal(TOTAL_SUPPLY);
            expect(await token.balanceOf(owner.address)).to.equal(0);

            // 4. GAME_OPERATOR_ROLE granted to game contract ✓
            const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
            expect(await token.hasRole(GAME_OPERATOR_ROLE, await game.getAddress())).to.be.true;

            // 5. Admin roles properly set ✓
            const DEFAULT_ADMIN_ROLE = await game.DEFAULT_ADMIN_ROLE();
            expect(await game.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Play-to-Earn Scenarios", function () {
        it("Should handle daily login rewards scenario", async function () {
            // Simulate daily login rewards for multiple players
            const loginPlayers = players.slice(0, 5);
            const dailyReward = ethers.parseEther("10");

            await game.connect(distributor).distributeEqualRewards(
                loginPlayers.map(p => p.address),
                dailyReward,
                "Daily Login Bonus"
            );

            // Check all players received their rewards
            for (const player of loginPlayers) {
                expect(await token.balanceOf(player.address)).to.equal(dailyReward);
            }

            // Check contract statistics
            const [totalDistributed, playersCount] = await game.getContractStats();
            expect(totalDistributed).to.equal(dailyReward * BigInt(loginPlayers.length));
            expect(playersCount).to.equal(loginPlayers.length);
        });

        it("Should handle tournament prize distribution", async function () {
            const winners = players.slice(0, 3);
            const prizes = [
                ethers.parseEther("1000"), // 1st place
                ethers.parseEther("500"),  // 2nd place
                ethers.parseEther("250")   // 3rd place
            ];

            await game.connect(distributor).distributeRewards(
                winners.map(p => p.address),
                prizes,
                "Weekly Tournament"
            );

            expect(await token.balanceOf(winners[0].address)).to.equal(prizes[0]);
            expect(await token.balanceOf(winners[1].address)).to.equal(prizes[1]);
            expect(await token.balanceOf(winners[2].address)).to.equal(prizes[2]);
        });

        it("Should handle in-game marketplace purchases", async function () {
            // Give player some tokens first
            const player = players[0];
            const initialReward = ethers.parseEther("1000");

            await game.connect(distributor).distributeRewards(
                [player.address],
                [initialReward],
                "Quest Completion"
            );

            // Player buys items from in-game marketplace
            const purchases = [
                { amount: ethers.parseEther("100"), itemId: 1001 }, // Weapon
                { amount: ethers.parseEther("50"), itemId: 2001 },  // Armor
                { amount: ethers.parseEther("25"), itemId: 3001 }   // Consumable
            ];

            for (const purchase of purchases) {
                await token.connect(player).approve(await game.getAddress(), purchase.amount);
                await expect(
                    game.connect(player).burnForPurchase(purchase.amount, purchase.itemId)
                ).to.emit(game, "TokensBurned");
            }

            const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0n);
            expect(await token.balanceOf(player.address)).to.equal(initialReward - totalSpent);
        });
    });

    describe("Gas Optimization Scenarios", function () {
        it("Should efficiently handle large batch operations", async function () {
            // Test with 100 players receiving equal rewards
            const batchPlayers = players.slice(0, 100);
            const rewardAmount = ethers.parseEther("5");

            const tx = await game.connect(distributor).distributeEqualRewards(
                batchPlayers.map(p => p.address),
                rewardAmount,
                "Mass Distribution Event"
            );

            const receipt = await tx.wait();

            // Should complete successfully with reasonable gas usage
            expect(receipt.status).to.equal(1);
            expect(receipt.gasUsed).to.be.lessThan(3000000); // Less than 3M gas

            // Verify all players received tokens
            for (const player of batchPlayers) {
                expect(await token.balanceOf(player.address)).to.equal(rewardAmount);
            }
        });

        it("Should compare gas usage between batch methods", async function () {
            const testPlayers = players.slice(0, 10);
            const amount = ethers.parseEther("10");

            // Test batchTransfer
            const amounts = new Array(testPlayers.length).fill(amount);
            const tx1 = await game.connect(distributor).distributeRewards(
                testPlayers.map(p => p.address),
                amounts,
                "Batch Transfer Test"
            );
            const receipt1 = await tx1.wait();

            // Reset balances by having players transfer back
            for (const player of testPlayers) {
                await token.connect(player).transfer(await game.getAddress(), amount);
            }

            // Test batchTransferEqual
            const tx2 = await game.connect(distributor).distributeEqualRewards(
                testPlayers.map(p => p.address),
                amount,
                "Batch Transfer Equal Test"
            );
            const receipt2 = await tx2.wait();

            // Equal transfers should be more gas efficient
            console.log(`batchTransfer gas: ${receipt1.gasUsed}`);
            console.log(`batchTransferEqual gas: ${receipt2.gasUsed}`);

            expect(receipt2.gasUsed).to.be.lessThan(receipt1.gasUsed);
        });
    });

    describe("Anti-Abuse Mechanisms", function () {
        it("Should enforce daily limits across multiple distributions", async function () {
            const player = players[0];
            const dailyLimit = await game.dailyRewardLimit();

            // Give player rewards up to the daily limit
            await game.connect(distributor).distributeRewards(
                [player.address],
                [dailyLimit],
                "Maximum Daily Reward"
            );

            // Attempting to give more should fail
            await expect(
                game.connect(distributor).distributeRewards(
                    [player.address],
                    [ethers.parseEther("1")],
                    "Exceeding Daily Limit"
                )
            ).to.be.revertedWith("MWG: Daily limit exceeded");
        });

        it("Should handle batch size limits", async function () {
            const maxBatchSize = await game.maxBatchSize();
            const oversizedBatch = new Array(Number(maxBatchSize) + 1).fill(players[0].address);
            const amounts = new Array(Number(maxBatchSize) + 1).fill(ethers.parseEther("1"));

            await expect(
                game.connect(distributor).distributeRewards(
                    oversizedBatch,
                    amounts,
                    "Oversized Batch"
                )
            ).to.be.revertedWith("MWG: Batch too large");
        });
    });

    describe("Emergency Scenarios", function () {
        it("Should handle emergency pause and recovery", async function () {
            // Normal operation
            await game.connect(distributor).distributeRewards(
                [players[0].address],
                [ethers.parseEther("100")],
                "Before Pause"
            );

            // Emergency pause
            await game.connect(gameAdmin).pause();

            // Operations should be blocked
            await expect(
                game.connect(distributor).distributeRewards(
                    [players[1].address],
                    [ethers.parseEther("100")],
                    "During Pause"
                )
            ).to.be.revertedWithCustomError(game, "EnforcedPause");

            // Token transfers should also be blocked if token is paused
            await token.pause();
            await expect(
                token.connect(players[0]).transfer(players[1].address, ethers.parseEther("50"))
            ).to.be.revertedWithCustomError(token, "EnforcedPause");

            // Recovery
            await game.connect(gameAdmin).unpause();
            await token.unpause();

            // Operations should resume
            await game.connect(distributor).distributeRewards(
                [players[1].address],
                [ethers.parseEther("100")],
                "After Recovery"
            );

            expect(await token.balanceOf(players[1].address)).to.equal(ethers.parseEther("100"));
        });

        it("Should handle emergency withdrawal", async function () {
            const withdrawAmount = ethers.parseEther("1000000"); // 1M tokens
            const initialGameBalance = await token.balanceOf(await game.getAddress());

            await game.connect(owner).emergencyWithdraw(withdrawAmount);

            expect(await token.balanceOf(owner.address)).to.equal(withdrawAmount);
            expect(await token.balanceOf(await game.getAddress())).to.equal(
                initialGameBalance - withdrawAmount
            );
        });
    });

    describe("Role-Based Security", function () {
        it("Should maintain proper role separation", async function () {
            const unauthorizedUser = players[0];

            // Should not be able to distribute rewards without REWARD_DISTRIBUTOR_ROLE
            await expect(
                game.connect(unauthorizedUser).distributeRewards(
                    [players[1].address],
                    [ethers.parseEther("100")],
                    "Unauthorized"
                )
            ).to.be.reverted;

            // Should not be able to change game settings without GAME_ADMIN_ROLE
            await expect(
                game.connect(unauthorizedUser).setDailyRewardLimit(ethers.parseEther("2000"))
            ).to.be.reverted;

            // Should not be able to emergency withdraw without DEFAULT_ADMIN_ROLE
            await expect(
                game.connect(unauthorizedUser).emergencyWithdraw(ethers.parseEther("1000"))
            ).to.be.reverted;
        });
    });

    describe("Long-term Operation Simulation", function () {
        it("Should handle extended gameplay simulation", async function () {
            // Simulate 30 days of gameplay
            const totalPlayers = Math.min(players.length, 20);
            const activePlayersPerDay = 10;
            const dailyRewardPerPlayer = ethers.parseEther("50");

            let totalDistributed = 0n;

            for (let day = 0; day < 30; day++) {
                // Select random players for this day
                const activePlayers = players
                    .slice(0, totalPlayers)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, activePlayersPerDay);

                // Advance time by 1 day (24 hours = 86400 seconds)
                if (day > 0) {
                    await network.provider.send("evm_increaseTime", [86400]);
                    await network.provider.send("evm_mine");
                }

                // Distribute daily rewards
                await game.connect(distributor).distributeEqualRewards(
                    activePlayers.map(p => p.address),
                    dailyRewardPerPlayer,
                    `Day ${day + 1} Rewards`
                );

                totalDistributed += dailyRewardPerPlayer * BigInt(activePlayersPerDay);

                // Some players make purchases (burn tokens)
                for (let i = 0; i < Math.min(3, activePlayers.length); i++) {
                    const player = activePlayers[i];
                    const playerBalance = await token.balanceOf(player.address);

                    if (playerBalance >= ethers.parseEther("25")) {
                        const purchaseAmount = ethers.parseEther("25");
                        await token.connect(player).approve(await game.getAddress(), purchaseAmount);
                        await game.connect(player).burnForPurchase(purchaseAmount, day * 100 + i);
                    }
                }
            }

            // Verify final state
            const [contractTotalDistributed, playersCount] = await game.getContractStats();
            expect(contractTotalDistributed).to.equal(totalDistributed);
            expect(playersCount).to.be.greaterThan(0);

            console.log(`Simulated 30 days: ${ethers.formatEther(totalDistributed)} tokens distributed to ${playersCount} players`);
        });
    });
});