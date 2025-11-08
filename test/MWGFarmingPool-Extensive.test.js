const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MWGFarmingPool - Extensive Tests", function () {
    let farmingPool;
    let mwgToken;
    let wbnb;
    let positionManager;
    let factory;
    let pool;
    let bnbUsdFeed;
    let owner;
    let user1;
    let rewardManager;

    const INITIAL_REWARD_RATE = ethers.parseEther("0.01"); // 0.01 MWG/sec
    const FARMING_DURATION = 365 * 24 * 3600;
    const REWARD_AMOUNT = ethers.parseEther("1000000");
    const MOCK_TOKEN_ID = 1;
    const MOCK_LIQUIDITY = ethers.parseUnits("1", 18);

    beforeEach(async function () {
        [owner, user1, rewardManager] = await ethers.getSigners();

        // Deploy MWG Token
        const MWGToken = await ethers.getContractFactory("MagicWorldGems");
        mwgToken = await MWGToken.deploy(
            "Magic World Gems",
            "MWG",
            ethers.parseEther("1000000000")
        );
        await mwgToken.waitForDeployment();

        // Mock WBNB
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        wbnb = await MockERC20.deploy("Wrapped BNB", "WBNB");
        await wbnb.waitForDeployment();

        // Mock Chainlink
        const MockChainlinkFeed = await ethers.getContractFactory("MockChainlinkAggregator");
        bnbUsdFeed = await MockChainlinkFeed.deploy(8);
        await bnbUsdFeed.waitForDeployment();
        await bnbUsdFeed.setLatestAnswer(60000000000);

        // Mock V3 factory + pool
        const MockV3Factory = await ethers.getContractFactory("MockUniswapV3Factory");
        factory = await MockV3Factory.deploy();
        await factory.waitForDeployment();

        const MockV3Pool = await ethers.getContractFactory("MockUniswapV3Pool");
        pool = await MockV3Pool.deploy(await wbnb.getAddress(), await mwgToken.getAddress(), 3000);
        await pool.waitForDeployment();

        await factory.setPool(await wbnb.getAddress(), await mwgToken.getAddress(), 3000, await pool.getAddress());

        // Position manager
        const MockPositionManager = await ethers.getContractFactory("MockNonfungiblePositionManager");
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

        // Grant roles
        const REWARD_ROLE = await farmingPool.REWARD_MANAGER_ROLE();
        await farmingPool.grantRole(REWARD_ROLE, rewardManager.address);

        // Deposit rewards
        await mwgToken.transfer(rewardManager.address, REWARD_AMOUNT);
        await mwgToken.connect(rewardManager).approve(await farmingPool.getAddress(), REWARD_AMOUNT);
        await farmingPool.connect(rewardManager).depositRewards(REWARD_AMOUNT);

        // Mint position to user
        await positionManager.mint(user1.address, MOCK_TOKEN_ID, await mwgToken.getAddress(), await wbnb.getAddress(), 3000, -887200, 887200, MOCK_LIQUIDITY);
    });

    it("initializePoolInfo succeeds when pool returns slot0", async function () {
        // set slot0
        await pool.setSlot0(123456789n, 100);

        await expect(farmingPool.initializePoolInfo()).to.emit(farmingPool, "PoolInfoInitialized");

        const pi = await farmingPool.poolInfo();
        expect(pi.sqrtPriceX96).to.equal(123456789n);
        expect(pi.currentTick).to.equal(100);
    });

    it("initializePoolInfo handles pool slot0 revert gracefully", async function () {
        await pool.setShouldRevert(true);

        await expect(farmingPool.initializePoolInfo()).to.emit(farmingPool, "PoolPriceUpdateFailed");

        const pi = await farmingPool.poolInfo();
        // Should not be set (remain zero)
        expect(pi.sqrtPriceX96).to.equal(0);
    });

    it("staking reverts when pool uninitialized (no position value)", async function () {
        // leave pool uninitialized
        // user approves NFT
        await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID);

        // Stake with 7 days (lockDays) should revert because position USD value cannot be calculated
        await expect(farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID, 7)).to.be.revertedWith(
            "Position has no value"
        );
    });

    it("stake + emergencyUnstake works when pool is initialized", async function () {
        // initialize pool so position USD value can be calculated
        await pool.setSlot0(2n ** 96n, 0); // non-zero sqrt price

        await positionManager.connect(user1).approve(await farmingPool.getAddress(), MOCK_TOKEN_ID);
        await farmingPool.connect(user1).stakePosition(MOCK_TOKEN_ID, 7);

        // Enable emergency and emergencyUnstake
        await farmingPool.enableEmergencyWithdraw();

        // Estimate gas - may fail in certain scenarios (MetaMask warning) but transaction should succeed
        try {
            await farmingPool.connect(user1).emergencyUnstake.estimateGas(MOCK_TOKEN_ID);
        } catch (e) {
            // ignore estimation failure
        }

        await expect(farmingPool.connect(user1).emergencyUnstake(MOCK_TOKEN_ID)).to.not.be.reverted;
        expect(await positionManager.ownerOf(MOCK_TOKEN_ID)).to.equal(user1.address);
    });

    it("updatePool uses external wrapper and does not revert when pool reverts", async function () {
        // make pool revert
        await pool.setShouldRevert(true);

        // calling updatePool should not revert (internal try-catch)
        await expect(farmingPool.updatePool()).to.not.be.reverted;

        // event PoolPriceUpdateFailed should be emitted when update is attempted via initialize
        await expect(farmingPool.initializePoolInfo()).to.emit(farmingPool, "PoolPriceUpdateFailed");
    });

});
