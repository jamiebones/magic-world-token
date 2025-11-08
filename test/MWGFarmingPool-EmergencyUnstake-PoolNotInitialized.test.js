const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MWGFarmingPool - Comprehensive Pool Info & Emergency Tests", function () {
    let farmingPool;
    let mwgToken;
    let wbnb;
    let positionManager;
    let factory;
    let pool;
    let bnbUsdFeed;
    let owner;
    let user1;
    let user2;

    const INITIAL_REWARD_RATE = ethers.parseEther("0.01"); // 0.01 MWG per second
    const FARMING_DURATION = 365 * 24 * 3600; // 1 year
    const REWARD_AMOUNT = ethers.parseEther("30000000"); // 30M MWG
    const MOCK_TOKEN_ID_1 = 1001;
    const MOCK_TOKEN_ID_2 = 1002;
    const MOCK_LIQUIDITY = ethers.parseUnits("0.001", 18);

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy MWG Token
        const MWGToken = await ethers.getContractFactory("MagicWorldGems");
        mwgToken = await MWGToken.deploy(
            "Magic World Gems",
            "MWG",
            ethers.parseEther("1000000000") // 1 billion
        );
        await mwgToken.waitForDeployment();

        // Deploy mock WBNB
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        wbnb = await MockERC20.deploy("Wrapped BNB", "WBNB");
        await wbnb.waitForDeployment();

        // Deploy mock Chainlink feed
        const MockChainlinkFeed = await ethers.getContractFactory(
            "MockChainlinkAggregator"
        );
        bnbUsdFeed = await MockChainlinkFeed.deploy(8); // 8 decimals
        await bnbUsdFeed.waitForDeployment();
        await bnbUsdFeed.setLatestAnswer(60000000000); // $600 with 8 decimals

        // Deploy mock Uniswap V3 contracts
        const MockV3Factory = await ethers.getContractFactory("MockUniswapV3Factory");
        factory = await MockV3Factory.deploy();
        await factory.waitForDeployment();

        const MockV3Pool = await ethers.getContractFactory("MockUniswapV3Pool");
        pool = await MockV3Pool.deploy(
            await wbnb.getAddress(),
            await mwgToken.getAddress(),
            3000
        );
        await pool.waitForDeployment();

        await factory.setPool(
            await wbnb.getAddress(),
            await mwgToken.getAddress(),
            3000,
            await pool.getAddress()
        );

        // Deploy mock position manager
        const MockPositionManager = await ethers.getContractFactory(
            "MockNonfungiblePositionManager"
        );
        positionManager = await MockPositionManager.deploy();
        await positionManager.waitForDeployment();

        // Deploy farming pool
        const MWGFarmingPool = await ethers.getContractFactory("MWGFarmingPool");
        farmingPool = await MWGFarmingPool.deploy(
            await positionManager.getAddress(),
            await factory.getAddress(),
            await mwgToken.getAddress(),
            await wbnb.getAddress(),
            await pool.getAddress(),
            await bnbUsdFeed.getAddress(),
            INITIAL_REWARD_RATE,
            FARMING_DURATION
        );
        await farmingPool.waitForDeployment();

        // Deposit rewards
        await mwgToken.approve(await farmingPool.getAddress(), REWARD_AMOUNT);
        await farmingPool.depositRewards(REWARD_AMOUNT);
    });


    describe("Scenario 1: Pool Info Initialized Successfully", function () {
        beforeEach(async function () {
            // Set valid pool data
            await pool.setSlot0(
                "1461446703485210103287273052203988822378723970341", // Example sqrtPriceX96
                -23028 // Example tick
            );
        });

        it("Should initialize pool info successfully", async function () {
            await farmingPool.initializePoolInfo();

            const poolInfo = await farmingPool.poolInfo();
            expect(poolInfo.sqrtPriceX96).to.not.equal(0);
            expect(poolInfo.lastUpdated).to.be.greaterThan(0);
        });

        it("Should stake position successfully with initialized pool", async function () {
            await farmingPool.initializePoolInfo();

            // Create and stake position
            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 0); // No lock

            const position = await farmingPool.stakedPositions(MOCK_TOKEN_ID_1);
            expect(position.owner).to.equal(user1.address);
            expect(position.usdValue).to.be.greaterThan(0);
        });

        it("Should unstake normally without emergency", async function () {
            await farmingPool.initializePoolInfo();

            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 0);

            // Fast forward time
            await time.increase(100);

            await farmingPool.connect(user1).unstakePosition(MOCK_TOKEN_ID_1);

            expect(await positionManager.ownerOf(MOCK_TOKEN_ID_1)).to.equal(user1.address);
        });

        it("Should handle emergency unstake with initialized pool", async function () {
            await farmingPool.initializePoolInfo();

            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 30 * 24 * 3600); // 30 day lock

            // Enable emergency
            await farmingPool.enableEmergencyWithdraw();

            // Emergency unstake should work
            await farmingPool.connect(user1).emergencyUnstake(MOCK_TOKEN_ID_1);

            expect(await positionManager.ownerOf(MOCK_TOKEN_ID_1)).to.equal(user1.address);
        });
    });

    describe("Scenario 2: Pool Info Update Fails (slot0 reverts)", function () {
        beforeEach(async function () {
            // Make pool.slot0() revert
            await pool.setShouldRevert(true);
        });

        it("Should handle initializePoolInfo failure gracefully", async function () {
            // initializePoolInfo should not revert, but emit event
            await expect(farmingPool.initializePoolInfo())
                .to.emit(farmingPool, "PoolPriceUpdateFailed");

            const poolInfo = await farmingPool.poolInfo();
            expect(poolInfo.sqrtPriceX96).to.equal(0); // Still zero
            expect(poolInfo.lastUpdated).to.be.greaterThan(0); // Timestamp updated
        });

        it("Should allow staking even when pool info update fails", async function () {
            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);

            // Staking should work even if pool info fails
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 0);

            const position = await farmingPool.stakedPositions(MOCK_TOKEN_ID_1);
            expect(position.owner).to.equal(user1.address);
        });

        it("Should not revert updatePool when pool info fails", async function () {
            // updatePool should not revert
            await expect(farmingPool.updatePool()).to.not.be.reverted;
        });

        it("Should emit PoolPriceUpdateFailed event when update fails", async function () {
            await expect(farmingPool.initializePoolInfo())
                .to.emit(farmingPool, "PoolPriceUpdateFailed");
        });
    });

    describe("Scenario 3: Pool Info Never Initialized (mimics mainnet)", function () {
        // Pool slot0 returns zeros by default (not set)

        it("Should show pool info as uninitialized", async function () {
            const poolInfo = await farmingPool.poolInfo();
            expect(poolInfo.sqrtPriceX96).to.equal(0);
            expect(poolInfo.currentTick).to.equal(0);
        });

        it("Should allow staking with uninitialized pool info", async function () {
            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 7 * 24 * 3600);

            const position = await farmingPool.stakedPositions(MOCK_TOKEN_ID_1);
            expect(position.owner).to.equal(user1.address);
            expect(position.liquidity).to.equal(MOCK_LIQUIDITY);
        });

        it("Should allow emergency unstake with uninitialized pool", async function () {
            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 7 * 24 * 3600);

            await farmingPool.enableEmergencyWithdraw();

            // Emergency unstake should work
            await expect(
                farmingPool.connect(user1).emergencyUnstake(MOCK_TOKEN_ID_1)
            ).to.not.be.reverted;

            expect(await positionManager.ownerOf(MOCK_TOKEN_ID_1)).to.equal(user1.address);
        });

        it("Should allow normal unstake after lock expires", async function () {
            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 7 * 24 * 3600);

            // Fast forward past lock
            await time.increase(8 * 24 * 3600);

            await expect(
                farmingPool.connect(user1).unstakePosition(MOCK_TOKEN_ID_1)
            ).to.not.be.reverted;

            expect(await positionManager.ownerOf(MOCK_TOKEN_ID_1)).to.equal(user1.address);
        });
    });

    describe("Scenario 4: External Wrapper Protection", function () {
        it("Should prevent external calls to _updatePoolInfoExternal", async function () {
            await expect(
                farmingPool.connect(user1)._updatePoolInfoExternal()
            ).to.be.revertedWith("Internal only");
        });

        it("Should allow internal calls from contract itself", async function () {
            // Set valid pool data
            await pool.setSlot0(
                "1461446703485210103287273052203988822378723970341",
                -23028
            );

            // initializePoolInfo calls _updatePoolInfo which calls _updatePoolInfoExternal
            await expect(farmingPool.initializePoolInfo()).to.not.be.reverted;
        });
    });

    describe("Scenario 5: Multiple Positions with Mixed Pool States", function () {
        it("Should handle multiple positions even with pool info failures", async function () {
            // Create first position (pool working)
            await pool.setSlot0(
                "1461446703485210103287273052203988822378723970341",
                -23028
            );

            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 0);

            // Break pool
            await pool.setShouldRevert(true);

            // Create second position (pool broken)
            await positionManager.mint(
                user2.address,
                MOCK_TOKEN_ID_2,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user2).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_2);
            await farmingPool.connect(user2).stakePosition(MOCK_TOKEN_ID_2, 0);

            // Both positions should exist
            const pos1 = await farmingPool.stakedPositions(MOCK_TOKEN_ID_1);
            const pos2 = await farmingPool.stakedPositions(MOCK_TOKEN_ID_2);

            expect(pos1.owner).to.equal(user1.address);
            expect(pos2.owner).to.equal(user2.address);

            // Both should be unstakeable
            await farmingPool.connect(user1).unstakePosition(MOCK_TOKEN_ID_1);
            await farmingPool.connect(user2).unstakePosition(MOCK_TOKEN_ID_2);

            expect(await positionManager.ownerOf(MOCK_TOKEN_ID_1)).to.equal(user1.address);
            expect(await positionManager.ownerOf(MOCK_TOKEN_ID_2)).to.equal(user2.address);
        });
    });

    describe("Scenario 6: updatePool() Resilience", function () {
        it("Should handle updatePool when pool price unavailable", async function () {
            // Pool returns zeros
            await expect(farmingPool.updatePool()).to.not.be.reverted;
        });

        it("Should handle updatePool when pool reverts", async function () {
            await pool.setShouldRevert(true);
            await expect(farmingPool.updatePool()).to.not.be.reverted;
        });

        it("Should update accRewardPerShare even without pool price", async function () {
            await positionManager.mint(
                user1.address,
                MOCK_TOKEN_ID_1,
                await mwgToken.getAddress(),
                await wbnb.getAddress(),
                3000,
                -887200,
                887200,
                MOCK_LIQUIDITY
            );

            await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID_1);
            await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID_1, 0);

            const accBefore = await farmingPool.accRewardPerShare();

            await time.increase(100);
            await farmingPool.updatePool();

            const accAfter = await farmingPool.accRewardPerShare();
            expect(accAfter).to.be.greaterThan(accBefore);
        });
    });
});
