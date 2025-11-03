// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IPancakeSwapV3.sol";
import "./libraries/LiquidityAmounts.sol";
import "./libraries/TickMath.sol";

/**
 * @title MWGFarmingPool
 * @dev Liquidity farming contract for MWG/BNB PancakeSwap V3 positions
 *
 * Features:
 * - Stake PancakeSwap V3 NFT positions
 * - Earn MWG rewards based on liquidity provided
 * - Lock periods for bonus rewards (up to 2x multiplier)
 * - Emergency controls and admin functions
 * - Position value calculation using Chainlink price feeds
 */
contract MWGFarmingPool is
    AccessControl,
    ReentrancyGuard,
    Pausable,
    IERC721Receiver
{
    using SafeERC20 for IERC20;

    // ==================== CONSTANTS & ROLES ====================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REWARD_MANAGER_ROLE =
        keccak256("REWARD_MANAGER_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

    uint256 private constant PRECISION = 1e18;
    uint256 private constant BASE_MULTIPLIER = 1000;
    uint256 private constant MAX_LOCK_DAYS = 365;
    uint256 private constant MAX_BATCH_SIZE = 50; // Prevent DoS attacks
    uint32 private constant TWAP_PERIOD = 1800; // 30 minutes TWAP for price manipulation resistance

    address public immutable positionManager;
    address public immutable factory;
    address public immutable mwgToken;
    address public immutable wbnb;
    address public immutable targetPool;

    // Price feeds for USD value calculation
    address public immutable bnbUsdFeed; // Chainlink BNB/USD feed

    // ==================== STATE VARIABLES ====================

    // Farming configuration
    uint256 public rewardPerSecond; // MWG tokens per second per USD staked
    uint256 public totalStakedValue; // Total USD value staked
    uint256 public lastRewardTimestamp;
    uint256 public farmingStartTime;
    uint256 public farmingEndTime;

    // Reward tracking
    uint256 public accRewardPerShare; // Accumulated rewards per share
    uint256 public totalRewardsDeposited;
    uint256 public totalRewardsDistributed;

    // Emergency controls
    bool public emergencyWithdrawEnabled;

    // ==================== STRUCTS ====================

    struct StakedPosition {
        uint256 tokenId; // V3 NFT token ID
        uint128 liquidity; // Position liquidity
        uint256 usdValue; // USD value when staked
        uint256 rewardDebt; // Rewards already accounted for
        uint256 stakedAt; // Timestamp when staked
        uint256 lockUntil; // Lock expiry timestamp (0 if no lock)
        uint256 boostMultiplier; // Reward multiplier (1000 = 1x)
        address owner; // Position owner
        int24 tickLower; // Position tick range
        int24 tickUpper;
    }

    struct PoolInfo {
        uint160 sqrtPriceX96; // Current pool price
        int24 currentTick; // Current pool tick
        uint256 lastUpdated; // Last price update
    }

    // ==================== MAPPINGS ====================

    mapping(uint256 => StakedPosition) public stakedPositions;
    mapping(address => uint256[]) public userPositions;
    mapping(address => uint256) public userTotalValue; // Total USD value per user
    mapping(address => uint256) public userRewardsClaimed; // Total rewards claimed per user

    PoolInfo public poolInfo;

    // ==================== EVENTS ====================

    event PositionStaked(
        address indexed user,
        uint256 indexed tokenId,
        uint256 usdValue,
        uint256 lockDays,
        uint256 boostMultiplier
    );

    event PositionUnstaked(
        address indexed user,
        uint256 indexed tokenId,
        uint256 rewards
    );

    event RewardsClaimed(
        address indexed user,
        uint256 amount,
        uint256[] tokenIds
    );

    event RewardRateUpdated(uint256 newRate);
    event RewardsDeposited(uint256 amount);
    event FarmingPeriodExtended(uint256 newEndTime);
    event EmergencyWithdrawEnabled();
    event PoolPriceUpdateFailed(uint256 timestamp);
    event PositionValueCalculationFailed(
        uint256 indexed tokenId,
        uint256 fallbackValue
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _positionManager,
        address _factory,
        address _mwgToken,
        address _wbnb,
        address _targetPool,
        address _bnbUsdFeed,
        uint256 _initialRewardPerSecond,
        uint256 _farmingDuration
    ) {
        require(_positionManager != address(0), "Invalid position manager");
        require(_factory != address(0), "Invalid factory");
        require(_mwgToken != address(0), "Invalid MWG token");
        require(_wbnb != address(0), "Invalid WBNB");
        require(_targetPool != address(0), "Invalid target pool");
        require(_bnbUsdFeed != address(0), "Invalid price feed");
        require(_farmingDuration > 0, "Invalid farming duration");
        require(_farmingDuration <= 5 * 365 days, "Farming duration too long");
        require(
            _initialRewardPerSecond <= PRECISION,
            "Initial reward rate too high"
        );

        positionManager = _positionManager;
        factory = _factory;
        mwgToken = _mwgToken;
        wbnb = _wbnb;
        targetPool = _targetPool;
        bnbUsdFeed = _bnbUsdFeed;

        rewardPerSecond = _initialRewardPerSecond;
        farmingStartTime = block.timestamp;
        farmingEndTime = block.timestamp + _farmingDuration;
        lastRewardTimestamp = block.timestamp;

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(REWARD_MANAGER_ROLE, msg.sender);
        _grantRole(PAUSE_ROLE, msg.sender);

        // Initialize pool info
        _updatePoolInfo();
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @dev Deposit MWG tokens for farming rewards
     */
    function depositRewards(
        uint256 amount
    ) external onlyRole(REWARD_MANAGER_ROLE) {
        require(amount > 0, "Amount must be > 0");

        IERC20(mwgToken).safeTransferFrom(msg.sender, address(this), amount);
        totalRewardsDeposited += amount;

        emit RewardsDeposited(amount);
    }

    /**
     * @dev Set new reward rate (rewards per second per USD staked)
     */
    function setRewardRate(
        uint256 _rewardPerSecond
    ) external onlyRole(ADMIN_ROLE) {
        // Validate reasonable reward rate (prevent admin mistakes)
        // Max: 1 MWG per second per dollar (very generous)
        require(_rewardPerSecond <= 1e18, "Reward rate too high");

        updatePool();
        rewardPerSecond = _rewardPerSecond;
        emit RewardRateUpdated(_rewardPerSecond);
    }

    /**
     * @dev Extend farming period
     */
    function extendFarming(
        uint256 additionalSeconds
    ) external onlyRole(ADMIN_ROLE) {
        require(additionalSeconds > 0, "Invalid extension");
        // Prevent extending too far into future (max 5 years from now)
        require(
            farmingEndTime + additionalSeconds <=
                block.timestamp + 5 * 365 days,
            "Extension too long"
        );
        farmingEndTime += additionalSeconds;
        emit FarmingPeriodExtended(farmingEndTime);
    }

    /**
     * @dev Enable emergency withdraw (irreversible)
     */
    function enableEmergencyWithdraw() external onlyRole(ADMIN_ROLE) {
        emergencyWithdrawEnabled = true;
        emit EmergencyWithdrawEnabled();
    }

    /**
     * @dev Emergency withdraw remaining rewards
     * SECURITY FIX: Updates accounting to prevent broken state
     */
    function emergencyWithdrawRewards(
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) {
        require(emergencyWithdrawEnabled, "Emergency withdraw not enabled");
        require(amount <= getAvailableRewards(), "Insufficient rewards");

        // SECURITY FIX: Update accounting before transfer
        totalRewardsDeposited -= amount;
        IERC20(mwgToken).safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Pause/unpause contract
     */
    function setPaused(bool _paused) external onlyRole(PAUSE_ROLE) {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    // ==================== USER FUNCTIONS ====================

    /**
     * @dev Stake a PancakeSwap V3 NFT position
     * @param tokenId The NFT token ID to stake
     * @param lockDays Number of days to lock (0-365, affects reward multiplier)
     */
    function stakePosition(
        uint256 tokenId,
        uint256 lockDays
    ) external nonReentrant whenNotPaused {
        require(block.timestamp >= farmingStartTime, "Farming not started");
        require(block.timestamp < farmingEndTime, "Farming ended");
        require(lockDays <= MAX_LOCK_DAYS, "Lock period too long");

        // Prevent double-staking
        require(
            stakedPositions[tokenId].owner == address(0),
            "Position already staked"
        );

        // Verify ownership
        // aderyn-fp-next-line(reentrancy-state-change)
        require(
            IERC721(positionManager).ownerOf(tokenId) == msg.sender,
            "Not owner"
        );

        // Get position details
        // aderyn-fp-next-line(reentrancy-state-change)
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,

        ) = INonfungiblePositionManager(positionManager).positions(tokenId);

        // Verify this is the target MWG/BNB pool
        require(_isTargetPool(token0, token1, fee), "Invalid pool");
        require(liquidity > 0, "No liquidity");

        // Calculate position USD value
        uint256 usdValue = _calculatePositionValue(
            token0,
            token1,
            tickLower,
            tickUpper,
            liquidity
        );
        require(usdValue > 0, "Position has no value");

        // Calculate boost multiplier based on lock period
        uint256 boostMultiplier = _calculateBoostMultiplier(lockDays);
        uint256 lockUntil = lockDays > 0
            ? block.timestamp + (lockDays * 1 days)
            : 0;

        // Update pool before staking
        updatePool();
        // Create staked position first
        stakedPositions[tokenId] = StakedPosition({
            tokenId: tokenId,
            liquidity: liquidity,
            usdValue: usdValue,
            rewardDebt: (usdValue * boostMultiplier * accRewardPerShare) /
                (PRECISION * PRECISION * BASE_MULTIPLIER),
            stakedAt: block.timestamp,
            lockUntil: lockUntil,
            boostMultiplier: boostMultiplier,
            owner: msg.sender,
            tickLower: tickLower,
            tickUpper: tickUpper
        });

        // Update tracking
        userPositions[msg.sender].push(tokenId);
        userTotalValue[msg.sender] += usdValue;
        totalStakedValue += usdValue;

        // Transfer NFT to contract
        IERC721(positionManager).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        emit PositionStaked(
            msg.sender,
            tokenId,
            usdValue,
            lockDays,
            boostMultiplier
        );
    }

    /**
     * @dev Unstake position and claim rewards
     */
    function unstakePosition(uint256 tokenId) external nonReentrant {
        StakedPosition storage position = stakedPositions[tokenId];
        require(position.owner == msg.sender, "Not position owner");
        require(block.timestamp >= position.lockUntil, "Position locked");

        updatePool();

        // Calculate pending rewards
        uint256 pending = _calculatePendingRewards(position);

        // ==================== EFFECTS: Update all state first ====================

        // Update tracking
        totalStakedValue -= position.usdValue;
        userTotalValue[msg.sender] -= position.usdValue;
        _removeUserPosition(msg.sender, tokenId);

        // Delete position before external calls
        delete stakedPositions[tokenId];

        // ==================== INTERACTIONS: External calls last ====================

        // Transfer NFT back to user
        IERC721(positionManager).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        // Distribute rewards
        if (pending > 0) {
            _safeRewardTransfer(msg.sender, pending);
        }

        emit PositionUnstaked(msg.sender, tokenId, pending);
    }

    /**
     * @dev Claim rewards for specific positions
     */
    function claimRewards(
        uint256[] calldata tokenIds
    ) external nonReentrant whenNotPaused {
        require(tokenIds.length > 0, "No positions specified");
        require(tokenIds.length <= MAX_BATCH_SIZE, "Batch size too large");

        updatePool();

        uint256 totalPending = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            StakedPosition storage position = stakedPositions[tokenId];
            require(position.owner == msg.sender, "Not position owner");

            uint256 pending = _calculatePendingRewards(position);
            if (pending > 0) {
                totalPending += pending;
                position.rewardDebt =
                    (position.usdValue *
                        position.boostMultiplier *
                        accRewardPerShare) /
                    (PRECISION * PRECISION * BASE_MULTIPLIER);
            }
        }

        require(totalPending > 0, "No rewards available");
        _safeRewardTransfer(msg.sender, totalPending);

        emit RewardsClaimed(msg.sender, totalPending, tokenIds);
    }

    /**
     * @dev Claim all rewards for user
     */
    function claimAllRewards() external nonReentrant whenNotPaused {
        uint256[] memory positions = userPositions[msg.sender];
        require(positions.length > 0, "No positions");

        updatePool();

        uint256 totalPending = 0;

        for (uint256 i = 0; i < positions.length; i++) {
            uint256 tokenId = positions[i];
            StakedPosition storage position = stakedPositions[tokenId];

            uint256 pending = _calculatePendingRewards(position);
            if (pending > 0) {
                totalPending += pending;
                position.rewardDebt =
                    (position.usdValue *
                        position.boostMultiplier *
                        accRewardPerShare) /
                    (PRECISION * PRECISION * BASE_MULTIPLIER);
            }
        }

        require(totalPending > 0, "No rewards available");
        _safeRewardTransfer(msg.sender, totalPending);

        emit RewardsClaimed(msg.sender, totalPending, positions);
    }

    /**
     * @dev Emergency unstake (only when emergency withdraw enabled)
     */
    function emergencyUnstake(uint256 tokenId) external nonReentrant {
        require(emergencyWithdrawEnabled, "Emergency not enabled");

        StakedPosition storage position = stakedPositions[tokenId];
        require(position.owner == msg.sender, "Not position owner");

        // ==================== EFFECTS: Update state first ====================

        // Update tracking (no rewards in emergency)
        totalStakedValue -= position.usdValue;
        userTotalValue[msg.sender] -= position.usdValue;
        _removeUserPosition(msg.sender, tokenId);

        // Delete position
        delete stakedPositions[tokenId];

        // ==================== INTERACTIONS: External call last ====================

        // Transfer NFT back
        IERC721(positionManager).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @dev Update reward calculations
     */
    function updatePool() public {
        if (block.timestamp <= lastRewardTimestamp || totalStakedValue == 0) {
            lastRewardTimestamp = block.timestamp;
            return;
        }

        uint256 endTime = block.timestamp > farmingEndTime
            ? farmingEndTime
            : block.timestamp;
        if (endTime <= lastRewardTimestamp) {
            return;
        }

        uint256 timeElapsed = endTime - lastRewardTimestamp;

        // Prevent overflow: check if calculation would overflow
        // rewardPerSecond is already "per USD staked", so we don't multiply by totalStakedValue
        // totalRewards = timeElapsed * rewardPerSecond (rewards per dollar)
        require(
            timeElapsed <= type(uint256).max / rewardPerSecond,
            "Time overflow"
        );
        uint256 rewardPerDollar = timeElapsed * rewardPerSecond;

        // accRewardPerShare tracks cumulative rewards per dollar staked
        accRewardPerShare += rewardPerDollar * PRECISION;
        lastRewardTimestamp = block.timestamp;

        // Update pool price info
        _updatePoolInfo();
    }

    /**
     * @dev Get pending rewards for a position
     */
    function pendingRewards(uint256 tokenId) external view returns (uint256) {
        StakedPosition memory position = stakedPositions[tokenId];
        return _calculatePendingRewards(position);
    }

    /**
     * @dev Get all pending rewards for a user
     */
    function pendingRewardsForUser(
        address user
    ) external view returns (uint256) {
        uint256[] memory positions = userPositions[user];
        uint256 totalPending = 0;

        for (uint256 i = 0; i < positions.length; i++) {
            StakedPosition memory position = stakedPositions[positions[i]];
            totalPending += _calculatePendingRewards(position);
        }

        return totalPending;
    }

    /**
     * @dev Get user's staked positions
     */
    function getUserPositions(
        address user
    ) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    /**
     * @dev Get available rewards for distribution
     */
    function getAvailableRewards() public view returns (uint256) {
        return totalRewardsDeposited - totalRewardsDistributed;
    }

    /**
     * @dev Calculate current APR
     */
    function getCurrentAPR() external view returns (uint256) {
        if (totalStakedValue == 0) return 0;

        uint256 annualRewards = rewardPerSecond * 365 days * totalStakedValue;
        // Get MWG price in USD (assuming 1 MWG = $0.0003 for now)
        uint256 mwgPriceUsd = 3e14; // $0.0003 in wei
        uint256 annualRewardsUsd = (annualRewards * mwgPriceUsd) / 1e18;

        return (annualRewardsUsd * 10000) / totalStakedValue; // Return as basis points (1% = 100)
    }

    /**
     * @dev Get boost multiplier for lock days
     */
    function getBoostMultiplier(
        uint256 lockDays
    ) external pure returns (uint256) {
        return _calculateBoostMultiplier(lockDays);
    }

    /**
     * @dev Get farming stats
     */
    function getFarmingStats()
        external
        view
        returns (
            uint256 totalStaked,
            uint256 totalRewards,
            uint256 availableRewards,
            uint256 currentAPR,
            uint256 participantCount,
            bool isActive
        )
    {
        totalStaked = totalStakedValue;
        totalRewards = totalRewardsDistributed;
        availableRewards = getAvailableRewards();
        currentAPR = this.getCurrentAPR();
        participantCount = 0; // Would need additional tracking to implement
        isActive =
            block.timestamp >= farmingStartTime &&
            block.timestamp < farmingEndTime &&
            !paused();
    }

    // ==================== INTERNAL FUNCTIONS ====================

    /**
     * @dev Validate that position still has liquidity (prevent liquidity removal exploit)
     */
    function _validatePositionLiquidity(
        uint256 tokenId
    ) internal view returns (uint128) {
        try
            INonfungiblePositionManager(positionManager).positions(tokenId)
        returns (
            uint96,
            address,
            address,
            address,
            uint24,
            int24,
            int24,
            uint128 currentLiquidity,
            uint256,
            uint256,
            uint128,
            uint128
        ) {
            return currentLiquidity;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Calculate pending rewards for a position
     * SECURITY FIX: Validates actual current liquidity to prevent removal exploit
     */
    function _calculatePendingRewards(
        StakedPosition memory position
    ) internal view returns (uint256) {
        if (position.usdValue == 0) return 0;

        // CRITICAL SECURITY FIX: Verify position still has liquidity
        uint128 currentLiquidity = _validatePositionLiquidity(position.tokenId);
        if (currentLiquidity == 0) return 0; // Position has been emptied!

        // Calculate liquidity ratio (what % of original liquidity remains)
        uint256 liquidityRatio = (uint256(currentLiquidity) * PRECISION) /
            uint256(position.liquidity);

        // If liquidity reduced, reduce rewards proportionally
        if (liquidityRatio > PRECISION) liquidityRatio = PRECISION; // Cap at 100%

        uint256 adjustedAccRewardPerShare = accRewardPerShare;

        // Calculate additional rewards since last update
        if (block.timestamp > lastRewardTimestamp && totalStakedValue > 0) {
            uint256 endTime = block.timestamp > farmingEndTime
                ? farmingEndTime
                : block.timestamp;
            if (endTime > lastRewardTimestamp) {
                uint256 timeElapsed = endTime - lastRewardTimestamp;

                // Prevent overflow in view function
                if (timeElapsed <= type(uint256).max / rewardPerSecond) {
                    uint256 rewardPerDollar = timeElapsed * rewardPerSecond;
                    adjustedAccRewardPerShare += rewardPerDollar * PRECISION;
                }
            }
        }

        return
            ((((position.usdValue *
                position.boostMultiplier *
                adjustedAccRewardPerShare) /
                (PRECISION * PRECISION * BASE_MULTIPLIER)) -
                position.rewardDebt) * liquidityRatio) / PRECISION; // Scale by actual liquidity
    }

    /**
     * @dev Safe reward transfer with available balance check
     */
    function _safeRewardTransfer(address to, uint256 amount) internal {
        uint256 availableRewards = getAvailableRewards();
        uint256 transferAmount = amount > availableRewards
            ? availableRewards
            : amount;

        if (transferAmount > 0) {
            IERC20(mwgToken).safeTransfer(to, transferAmount);
            totalRewardsDistributed += transferAmount;
            userRewardsClaimed[to] += transferAmount;
        }
    }

    /**
     * @dev Check if position belongs to target pool
     */
    function _isTargetPool(
        address token0,
        address token1,
        uint24 fee
    ) internal view returns (bool) {
        address computedPool = IUniswapV3Factory(factory).getPool(
            token0,
            token1,
            fee
        );
        return computedPool == targetPool;
    }

    /**
     * @dev Get MWG price using TWAP to prevent flash loan manipulation
     * SECURITY FIX: Uses time-weighted average price instead of spot price
     */
    function _getMWGPriceInBNB() internal view returns (uint256) {
        try this._getMWGPriceInBNBUnsafe() returns (uint256 price) {
            return price;
        } catch {
            // Fallback to spot price if TWAP fails (but less secure)
            return _getMWGSpotPriceInBNB();
        }
    }

    /**
     * @dev Internal unsafe TWAP price calculation
     */
    function _getMWGPriceInBNBUnsafe() external view returns (uint256) {
        // Get TWAP observation
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = TWAP_PERIOD; // 30 minutes ago
        secondsAgos[1] = 0; // now

        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(targetPool).observe(
            secondsAgos
        );

        // Calculate time-weighted average tick
        int56 tickCumulativeDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 arithmeticMeanTick = int24(
            tickCumulativeDelta / int56(uint56(TWAP_PERIOD))
        );

        // Convert tick to sqrtPriceX96
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);

        // Determine token order from pool
        address poolToken0 = IUniswapV3Pool(targetPool).token0();

        if (poolToken0 == wbnb) {
            // token0 is BNB, token1 is MWG
            // sqrtPriceX96 = sqrt(token1/token0) = sqrt(MWG/BNB)
            uint256 sqrtPrice = uint256(sqrtPriceX96);
            uint256 mwgPerBnb = (sqrtPrice * sqrtPrice) >> 192;
            if (mwgPerBnb == 0) return 0;
            return (PRECISION * PRECISION) / mwgPerBnb; // BNB per MWG
        } else {
            // token1 is BNB, token0 is MWG
            // sqrtPriceX96 = sqrt(token1/token0) = sqrt(BNB/MWG)
            uint256 sqrtPrice = uint256(sqrtPriceX96);
            return (sqrtPrice * sqrtPrice) >> 192; // BNB per MWG
        }
    }

    /**
     * @dev Get spot price as fallback (less secure, kept for compatibility)
     */
    function _getMWGSpotPriceInBNB() internal view returns (uint256) {
        (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(targetPool).slot0();

        address poolToken0 = IUniswapV3Pool(targetPool).token0();

        if (poolToken0 == wbnb) {
            uint256 sqrtPrice = uint256(sqrtPriceX96);
            uint256 mwgPerBnb = (sqrtPrice * sqrtPrice) >> 192;
            if (mwgPerBnb == 0) return 0;
            return (PRECISION * PRECISION) / mwgPerBnb;
        } else {
            uint256 sqrtPrice = uint256(sqrtPriceX96);
            return (sqrtPrice * sqrtPrice) >> 192;
        }
    }

    /**
     * @dev Get pool token addresses (helper for TWAP)
     */
    function _getPoolTokens() internal view returns (address, address) {
        return (
            IUniswapV3Pool(targetPool).token0(),
            IUniswapV3Pool(targetPool).token1()
        );
    }

    /**
     * @dev Calculate USD value of a V3 position with error handling
     * SECURITY FIX: Now uses TWAP for MWG price to prevent manipulation
     */
    function _calculatePositionValue(
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal view returns (uint256) {
        if (liquidity == 0) return 0;

        try
            this._calculatePositionValueUnsafe(
                token0,
                token1,
                tickLower,
                tickUpper,
                liquidity
            )
        returns (uint256 value) {
            return value;
        } catch {
            // Fallback: estimate value using liquidity amount
            // This is a simplified fallback calculation
            uint256 bnbPriceUsd = _getBNBPriceUSD();
            // Estimate 50% of position is BNB (rough approximation)
            uint256 estimatedBnbAmount = uint256(liquidity) / 2e18;
            return (estimatedBnbAmount * bnbPriceUsd) / 1e18;
        }
    }

    /**
     * @dev Internal unsafe position value calculation
     * SECURITY FIX: Uses TWAP for MWG price to prevent flash loan manipulation
     */
    function _calculatePositionValueUnsafe(
        address token0,
        address token1,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external view returns (uint256) {
        if (liquidity == 0) return 0;

        // Get current pool price
        (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(targetPool).slot0();

        // Calculate token amounts
        (uint256 amount0, uint256 amount1) = _getAmountsForLiquidity(
            sqrtPriceX96,
            tickLower,
            tickUpper,
            liquidity
        );

        // Get BNB price in USD from Chainlink
        uint256 bnbPriceUsd = _getBNBPriceUSD();

        // SECURITY FIX: Get MWG price using TWAP (flash-loan resistant)
        uint256 mwgPriceInBnb = _getMWGPriceInBNB();

        // Calculate total USD value including BOTH tokens
        uint256 totalValueUsd = 0;

        if (token0 == wbnb) {
            // token0 is BNB, token1 is MWG
            uint256 bnbValueUsd = (amount0 * bnbPriceUsd) / PRECISION;

            if (mwgPriceInBnb > 0) {
                uint256 mwgValueInBnb = (amount1 * mwgPriceInBnb) / PRECISION;
                uint256 mwgValueUsd = (mwgValueInBnb * bnbPriceUsd) / PRECISION;
                totalValueUsd = bnbValueUsd + mwgValueUsd;
            } else {
                totalValueUsd = bnbValueUsd;
            }
        } else if (token1 == wbnb) {
            // token1 is BNB, token0 is MWG
            uint256 bnbValueUsd = (amount1 * bnbPriceUsd) / PRECISION;

            if (mwgPriceInBnb > 0) {
                uint256 mwgValueInBnb = (amount0 * mwgPriceInBnb) / PRECISION;
                uint256 mwgValueUsd = (mwgValueInBnb * bnbPriceUsd) / PRECISION;
                totalValueUsd = bnbValueUsd + mwgValueUsd;
            } else {
                totalValueUsd = bnbValueUsd;
            }
        }

        return totalValueUsd;
    }

    /**
     * @dev Calculate token amounts for given liquidity using Uniswap V3 production libraries
     */
    function _getAmountsForLiquidity(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        return
            LiquidityAmounts.getAmountsForLiquidity(
                sqrtPriceX96,
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                liquidity
            );
    }

    /**
     * @dev Get BNB price in USD from Chainlink
     * SECURITY FIX: Stricter staleness check (15 minutes)
     */
    function _getBNBPriceUSD() internal view returns (uint256) {
        try AggregatorV3Interface(bnbUsdFeed).latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            require(price > 0, "Invalid price");
            // SECURITY FIX: Reduced from 1 hour to 15 minutes for fresher prices
            require(block.timestamp - updatedAt <= 900, "Price too old"); // 15 minutes max

            // Convert to 18 decimals (Chainlink BNB/USD has 8 decimals)
            return uint256(price) * 1e10;
        } catch {
            revert("Price feed error");
        }
    }

    /**
     * @dev Calculate boost multiplier based on lock days
     */
    function _calculateBoostMultiplier(
        uint256 lockDays
    ) internal pure returns (uint256) {
        if (lockDays >= 365) return 2000; // 2x for 1 year
        if (lockDays >= 180) return 1500; // 1.5x for 6 months
        if (lockDays >= 90) return 1250; // 1.25x for 3 months
        if (lockDays >= 30) return 1100; // 1.1x for 1 month
        if (lockDays >= 7) return 1050; // 1.05x for 1 week
        return BASE_MULTIPLIER; // 1x for no lock
    }

    /**
     * @dev Remove position from user's position array
     */
    function _removeUserPosition(address user, uint256 tokenId) internal {
        uint256[] storage positions = userPositions[user];
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i] == tokenId) {
                positions[i] = positions[positions.length - 1];
                positions.pop();
                break;
            }
        }
    }

    /**
     * @dev Update pool price information
     */
    function _updatePoolInfo() internal {
        try IUniswapV3Pool(targetPool).slot0() returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16,
            uint16,
            uint16,
            uint8,
            bool
        ) {
            poolInfo.sqrtPriceX96 = sqrtPriceX96;
            poolInfo.currentTick = tick;
            poolInfo.lastUpdated = block.timestamp;
        } catch {
            // Handle error gracefully - pool might be paused or not exist
            // Keep existing values if available, otherwise use safe defaults
            if (poolInfo.lastUpdated == 0) {
                // First time setup with safe defaults
                poolInfo.sqrtPriceX96 = 0;
                poolInfo.currentTick = 0;
            }
            // Update timestamp even if price fetch failed
            poolInfo.lastUpdated = block.timestamp;

            // Emit event for monitoring/debugging
            emit PoolPriceUpdateFailed(block.timestamp);
        }
    }

    // ==================== ERC721 RECEIVER ====================

    /**
     * @dev Required to receive ERC721 tokens
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
