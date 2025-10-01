// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMagicWorldToken.sol";

/**
 * @title MagicWorldGame
 * @dev Game contract that manages Magic World Token distribution for play-to-earn mechanics
 *
 * Features:
 * - Owns and manages the entire token supply
 * - Implements daily reward limits and anti-abuse mechanisms
 * - Role-based access for game servers and administrators
 * - Rate limiting for reward distribution
 * - Integration point for off-chain game servers
 */
contract MagicWorldGame is AccessControl, Pausable, ReentrancyGuard {
    // The Magic World Token contract
    IMagicWorldToken public immutable magicWorldToken;

    // Role definitions
    bytes32 public constant GAME_ADMIN_ROLE = keccak256("GAME_ADMIN_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE =
        keccak256("REWARD_DISTRIBUTOR_ROLE");

    // Constants for time calculations
    uint256 private constant SECONDS_PER_HOUR = 3600;
    uint256 private constant SECONDS_PER_DAY = 86400;
    uint256 private constant DAYS_PER_YEAR = 365;

    // Constants for percentage calculations
    uint256 private constant PERCENTAGE_BASE = 100;
    uint256 private constant PLAYER_TASKS_PERCENT = 50;
    uint256 private constant SOCIAL_FOLLOWERS_PERCENT = 5;
    uint256 private constant SOCIAL_POSTERS_PERCENT = 15;
    uint256 private constant ECOSYSTEM_FUND_PERCENT = 30;

    // Constants for limits
    uint256 private constant MAX_BATCH_SIZE_LIMIT = 500;
    uint256 private constant MIN_COOLDOWN_PERIOD = 60; // 1 minute
    uint256 private constant MAX_COOLDOWN_PERIOD = 7 * SECONDS_PER_DAY; // 7 days
    uint256 private constant MIN_DAILY_LIMIT = 1 * 10 ** 18; // 1 token minimum
    uint256 private constant COOLDOWN_THRESHOLD = 100 * 10 ** 18; // 100 tokens

    /**
     * @dev Modifier to ensure vaults are initialized before distribution
     */
    modifier vaultsInitializedRequired() {
        require(vaultsInitialized, "MWG: Vaults not initialized");
        _;
    }

    // Vault system for token allocation management
    enum AllocationType {
        PLAYER_TASKS, // 50% - Gameplay rewards
        SOCIAL_FOLLOWERS, // 5% - Community engagement
        SOCIAL_POSTERS, // 15% - Content creation
        ECOSYSTEM_FUND // 30% - Development & operations
    }

    struct AllocationVault {
        uint256 totalAllocated;
        uint256 spent;
        uint256 remaining;
    }

    mapping(AllocationType => AllocationVault) public vaults;

    // Vault initialization tracking
    bool public vaultsInitialized;

    // Rate limiting and anti-abuse
    uint256 public dailyRewardLimit = 1000 * 10 ** 18; // 1000 tokens per day per player
    uint256 public maxBatchSize = 200;
    uint256 public cooldownPeriod = SECONDS_PER_HOUR; // 1 hour minimum time between major rewards

    // Player tracking
    mapping(address => uint256) public dailyRewardsReceived;
    mapping(address => uint256) public lastRewardDate;
    mapping(address => uint256) public lastMajorReward;
    mapping(address => uint256) public totalRewardsEarned;

    // Game statistics
    uint256 public totalRewardsDistributed;
    uint256 public totalPlayersRewarded;
    uint256 public currentDay;

    // Events
    event RewardsDistributed(
        address indexed distributor,
        address[] recipients,
        uint256[] amounts,
        string reason
    );
    event VaultDistributed(
        address indexed distributor,
        AllocationType vaultType,
        address[] recipients,
        uint256[] amounts,
        string reason
    );
    event VaultsInitialized(uint256 totalSupply, uint256 partnerAllocation);
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event MaxBatchSizeUpdated(uint256 oldSize, uint256 newSize);
    event CooldownPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event TokensBurned(address indexed player, uint256 amount, uint256 itemId);
    event EmergencyWithdraw(address indexed admin, uint256 amount);
    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );
    event DailyLimitExhausted(
        address indexed player,
        uint256 attemptedAmount,
        uint256 currentReceived,
        uint256 dailyLimit
    );

    /**
     * @dev Constructor sets up the game contract with token reference
     * @param _tokenAddress Address of the Magic World Token contract
     *
     * Requirements:
     * - Token address must not be zero
     *
     * Effects:
     * - Grants DEFAULT_ADMIN_ROLE, GAME_ADMIN_ROLE, and REWARD_DISTRIBUTOR_ROLE to deployer
     * - Initializes currentDay based on block.timestamp
     */
    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "MWG: Invalid token address");

        magicWorldToken = IMagicWorldToken(_tokenAddress);

        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(GAME_ADMIN_ROLE, _msgSender());
        _grantRole(REWARD_DISTRIBUTOR_ROLE, _msgSender());

        // Initialize current day
        currentDay = block.timestamp / SECONDS_PER_DAY;
    }

    /**
     * @dev Initialize token allocation vaults
     * @param totalSupply Total token supply
     * @param partnerAllocation Amount allocated to partners (10%)
     *
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     * - Vaults must not be already initialized
     * - Total supply must be greater than zero
     * - Partner allocation must not exceed total supply
     *
     * Vault Allocations (of remaining supply after partner allocation):
     * - Player Tasks: 50%
     * - Social Followers: 5%
     * - Social Posters: 15%
     * - Ecosystem Fund: 30% (calculated as remainder to avoid rounding errors)
     *
     * Emits a {VaultsInitialized} event
     */
    function initializeVaults(
        uint256 totalSupply,
        uint256 partnerAllocation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!vaultsInitialized, "MWG: Vaults already initialized");
        require(totalSupply > 0, "MWG: Invalid total supply");
        require(
            partnerAllocation <= totalSupply,
            "MWG: Partner allocation too large"
        );

        uint256 remainingSupply = totalSupply - partnerAllocation;

        // Calculate vault allocations using integer division
        // Assign remainder to last vault to avoid rounding errors
        uint256 playerTasksAmount = (remainingSupply * PLAYER_TASKS_PERCENT) /
            PERCENTAGE_BASE;
        uint256 socialFollowersAmount = (remainingSupply *
            SOCIAL_FOLLOWERS_PERCENT) / PERCENTAGE_BASE;
        uint256 socialPostersAmount = (remainingSupply *
            SOCIAL_POSTERS_PERCENT) / PERCENTAGE_BASE;

        // Calculate ecosystem fund as remainder to ensure all tokens are allocated
        uint256 ecosystemFundAmount = remainingSupply -
            playerTasksAmount -
            socialFollowersAmount -
            socialPostersAmount;

        // Initialize vaults with calculated amounts
        vaults[AllocationType.PLAYER_TASKS] = AllocationVault({
            totalAllocated: playerTasksAmount,
            spent: 0,
            remaining: playerTasksAmount
        });

        vaults[AllocationType.SOCIAL_FOLLOWERS] = AllocationVault({
            totalAllocated: socialFollowersAmount,
            spent: 0,
            remaining: socialFollowersAmount
        });

        vaults[AllocationType.SOCIAL_POSTERS] = AllocationVault({
            totalAllocated: socialPostersAmount,
            spent: 0,
            remaining: socialPostersAmount
        });

        vaults[AllocationType.ECOSYSTEM_FUND] = AllocationVault({
            totalAllocated: ecosystemFundAmount,
            spent: 0,
            remaining: ecosystemFundAmount
        });

        vaultsInitialized = true;

        emit VaultsInitialized(totalSupply, partnerAllocation);
    }

    /**
     * @dev Distribute rewards from a specific vault
     * @param vaultType Type of allocation vault to use
     * @param recipients Array of player addresses
     * @param amounts Array of reward amounts
     * @param reason Reason for the reward distribution
     */
    function distributeFromVault(
        AllocationType vaultType,
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    )
        external
        onlyRole(REWARD_DISTRIBUTOR_ROLE)
        whenNotPaused
        nonReentrant
        vaultsInitializedRequired
    {
        require(
            recipients.length == amounts.length,
            "MWG: Array length mismatch"
        );
        require(recipients.length > 0, "MWG: Empty arrays");
        require(recipients.length <= maxBatchSize, "MWG: Batch too large");

        // Check vault balance
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        require(
            vaults[vaultType].remaining >= totalAmount,
            "MWG: Insufficient vault balance"
        );

        _updateCurrentDay();

        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            require(recipient != address(0), "MWG: Invalid recipient");
            require(amount > 0, "MWG: Zero amount");

            // Check daily limits
            _checkDailyLimit(recipient, amount);

            // Update player statistics
            _updatePlayerStats(recipient, amount);
        }

        // Deduct from vault
        vaults[vaultType].spent += totalAmount;
        vaults[vaultType].remaining -= totalAmount;

        // Use batch transfer for efficiency
        magicWorldToken.batchTransfer(recipients, amounts);

        emit VaultDistributed(
            _msgSender(),
            vaultType,
            recipients,
            amounts,
            reason
        );
    }

    /**
     * @dev Distribute equal rewards from a specific vault
     * @param vaultType Type of allocation vault to use
     * @param recipients Array of player addresses
     * @param amount Amount to give each player
     * @param reason Reason for the reward distribution
     */
    function distributeEqualFromVault(
        AllocationType vaultType,
        address[] calldata recipients,
        uint256 amount,
        string calldata reason
    )
        external
        onlyRole(REWARD_DISTRIBUTOR_ROLE)
        whenNotPaused
        nonReentrant
        vaultsInitializedRequired
    {
        require(recipients.length > 0, "MWG: Empty recipients");
        require(recipients.length <= maxBatchSize, "MWG: Batch too large");
        require(amount > 0, "MWG: Zero amount");

        uint256 totalAmount = recipients.length * amount;
        require(
            vaults[vaultType].remaining >= totalAmount,
            "MWG: Insufficient vault balance"
        );

        _updateCurrentDay();

        // Create amounts array for event emission
        uint256[] memory amounts = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            require(recipient != address(0), "MWG: Invalid recipient");

            // Check daily limits
            _checkDailyLimit(recipient, amount);

            // Update player statistics
            _updatePlayerStats(recipient, amount);

            amounts[i] = amount;
        }

        // Deduct from vault
        vaults[vaultType].spent += totalAmount;
        vaults[vaultType].remaining -= totalAmount;

        // Use batch transfer equal for gas efficiency
        magicWorldToken.batchTransferEqual(recipients, amount);

        emit VaultDistributed(
            _msgSender(),
            vaultType,
            recipients,
            amounts,
            reason
        );
    }

    /**
     * @dev Burn tokens for in-game purchases
     * @param amount Amount of tokens to burn
     * @param itemId ID of the item being purchased
     */
    function burnForPurchase(
        uint256 amount,
        uint256 itemId
    ) external whenNotPaused nonReentrant {
        require(amount > 0, "MWG: Zero amount");
        require(
            magicWorldToken.balanceOf(_msgSender()) >= amount,
            "MWG: Insufficient balance"
        );

        // Transfer tokens to this contract (effectively burning them)
        magicWorldToken.transferFrom(_msgSender(), address(this), amount);

        emit TokensBurned(_msgSender(), amount, itemId);
    }

    /**
     * @dev Update daily reward limit (admin only)
     * @param newLimit New daily limit per player
     *
     * Requirements:
     * - Caller must have GAME_ADMIN_ROLE
     * - New limit must be at least MIN_DAILY_LIMIT (1 token)
     *
     * Emits a {DailyLimitUpdated} event
     */
    function setDailyRewardLimit(
        uint256 newLimit
    ) external onlyRole(GAME_ADMIN_ROLE) {
        require(newLimit >= MIN_DAILY_LIMIT, "MWG: Daily limit too low");
        uint256 oldLimit = dailyRewardLimit;
        dailyRewardLimit = newLimit;
        emit DailyLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @dev Update maximum batch size (admin only)
     * @param newSize New maximum batch size
     *
     * Requirements:
     * - Caller must have GAME_ADMIN_ROLE
     * - New size must be greater than 0
     * - New size must not exceed MAX_BATCH_SIZE_LIMIT (500)
     *
     * Emits a {MaxBatchSizeUpdated} event
     */
    function setMaxBatchSize(
        uint256 newSize
    ) external onlyRole(GAME_ADMIN_ROLE) {
        require(newSize > 0, "MWG: Batch size must be positive");
        require(
            newSize <= MAX_BATCH_SIZE_LIMIT,
            "MWG: Batch size exceeds maximum"
        );
        uint256 oldSize = maxBatchSize;
        maxBatchSize = newSize;
        emit MaxBatchSizeUpdated(oldSize, newSize);
    }

    /**
     * @dev Update cooldown period (admin only)
     * @param newPeriod New cooldown period in seconds
     *
     * Requirements:
     * - Caller must have GAME_ADMIN_ROLE
     * - New period must be at least MIN_COOLDOWN_PERIOD (1 minute)
     * - New period must not exceed MAX_COOLDOWN_PERIOD (7 days)
     *
     * Emits a {CooldownPeriodUpdated} event
     */
    function setCooldownPeriod(
        uint256 newPeriod
    ) external onlyRole(GAME_ADMIN_ROLE) {
        require(newPeriod >= MIN_COOLDOWN_PERIOD, "MWG: Cooldown too short");
        require(newPeriod <= MAX_COOLDOWN_PERIOD, "MWG: Cooldown too long");
        uint256 oldPeriod = cooldownPeriod;
        cooldownPeriod = newPeriod;
        emit CooldownPeriodUpdated(oldPeriod, newPeriod);
    }

    /**
     * @dev Emergency withdraw function (admin only)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount > 0, "MWG: Zero amount");
        require(
            magicWorldToken.balanceOf(address(this)) >= amount,
            "MWG: Insufficient balance"
        );

        magicWorldToken.transfer(_msgSender(), amount);
        emit EmergencyWithdraw(_msgSender(), amount);
    }

    /**
     * @dev Pause the contract (admin only)
     */
    function pause() external onlyRole(GAME_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract (admin only)
     */
    function unpause() external onlyRole(GAME_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Get player reward statistics
     * @param player Player address
     * @return dailyReceived Amount received today
     * @return totalEarned Total rewards earned
     * @return lastReward Timestamp of last reward
     */
    function getPlayerStats(
        address player
    )
        external
        view
        returns (uint256 dailyReceived, uint256 totalEarned, uint256 lastReward)
    {
        return (
            dailyRewardsReceived[player],
            totalRewardsEarned[player],
            lastMajorReward[player]
        );
    }

    /**
     * @dev Get contract statistics
     * @return totalDistributed Total rewards distributed
     * @return playersCount Total players rewarded
     * @return contractBalance Current token balance
     */
    function getContractStats()
        external
        view
        returns (
            uint256 totalDistributed,
            uint256 playersCount,
            uint256 contractBalance
        )
    {
        return (
            totalRewardsDistributed,
            totalPlayersRewarded,
            magicWorldToken.balanceOf(address(this))
        );
    }

    /**
     * @dev Get vault information
     * @param vaultType Type of allocation vault
     * @return totalAllocated Total tokens allocated to vault
     * @return spent Amount spent from vault
     * @return remaining Amount remaining in vault
     */
    function getVaultInfo(
        AllocationType vaultType
    )
        external
        view
        returns (uint256 totalAllocated, uint256 spent, uint256 remaining)
    {
        AllocationVault memory vault = vaults[vaultType];
        return (vault.totalAllocated, vault.spent, vault.remaining);
    }

    /**
     * @dev Get all vault statistics
     * @return playerTasks Vault info for player tasks
     * @return socialFollowers Vault info for social followers
     * @return socialPosters Vault info for social posters
     * @return ecosystemFund Vault info for ecosystem fund
     */
    function getAllVaultStats()
        external
        view
        returns (
            AllocationVault memory playerTasks,
            AllocationVault memory socialFollowers,
            AllocationVault memory socialPosters,
            AllocationVault memory ecosystemFund
        )
    {
        return (
            vaults[AllocationType.PLAYER_TASKS],
            vaults[AllocationType.SOCIAL_FOLLOWERS],
            vaults[AllocationType.SOCIAL_POSTERS],
            vaults[AllocationType.ECOSYSTEM_FUND]
        );
    }

    /**
     * @dev Internal function to check daily limits and cooldown period
     * @param recipient Address of the reward recipient
     * @param amount Amount of tokens to be distributed
     *
     * Requirements:
     * - Recipient's daily received amount plus new amount must not exceed dailyRewardLimit
     * - For rewards >= COOLDOWN_THRESHOLD, cooldown period must have elapsed since last major reward
     *
     * Note: DailyLimitExhausted event is emitted by caller if this check fails
     */
    function _checkDailyLimit(address recipient, uint256 amount) internal view {
        uint256 todayReceived = (lastRewardDate[recipient] == currentDay)
            ? dailyRewardsReceived[recipient]
            : 0;

        require(
            todayReceived + amount <= dailyRewardLimit,
            "MWG: Daily limit exceeded"
        );

        // Enforce cooldown period for major rewards
        if (amount >= COOLDOWN_THRESHOLD) {
            require(
                block.timestamp >= lastMajorReward[recipient] + cooldownPeriod,
                "MWG: Cooldown period not elapsed"
            );
        }
    }

    /**
     * @dev Internal function to update player statistics
     */
    function _updatePlayerStats(address recipient, uint256 amount) internal {
        // Update daily tracking
        if (lastRewardDate[recipient] != currentDay) {
            dailyRewardsReceived[recipient] = 0;
            lastRewardDate[recipient] = currentDay;
        }

        dailyRewardsReceived[recipient] += amount;
        totalRewardsEarned[recipient] += amount;
        lastMajorReward[recipient] = block.timestamp;

        // Update global statistics
        totalRewardsDistributed += amount;

        // Count new players
        if (totalRewardsEarned[recipient] == amount) {
            totalPlayersRewarded++;
        }
    }

    /**
     * @dev Internal function to update current day based on block timestamp
     *
     * Effects:
     * - Updates currentDay if a new day has started
     */
    function _updateCurrentDay() internal {
        uint256 today = block.timestamp / SECONDS_PER_DAY;
        if (today > currentDay) {
            currentDay = today;
        }
    }

    /**
     * @dev Grant reward distributor role to an account (admin only)
     * @param account Address to grant the role to
     */
    function grantDistributorRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MWG: Invalid account");
        _grantRole(REWARD_DISTRIBUTOR_ROLE, account);
    }

    /**
     * @dev Revoke reward distributor role from an account (admin only)
     * @param account Address to revoke the role from
     */
    function revokeDistributorRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(REWARD_DISTRIBUTOR_ROLE, account);
    }

    /**
     * @dev Grant game admin role to an account (admin only)
     * @param account Address to grant the role to
     */
    function grantGameAdminRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MWG: Invalid account");
        _grantRole(GAME_ADMIN_ROLE, account);
    }

    /**
     * @dev Revoke game admin role from an account (admin only)
     * @param account Address to revoke the role from
     */
    function revokeGameAdminRole(
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(GAME_ADMIN_ROLE, account);
    }

    /**
     * @dev Check if an account has reward distributor role
     * @param account Address to check
     */
    function isDistributor(address account) external view returns (bool) {
        return hasRole(REWARD_DISTRIBUTOR_ROLE, account);
    }

    /**
     * @dev Check if an account has game admin role
     * @param account Address to check
     */
    function isGameAdmin(address account) external view returns (bool) {
        return hasRole(GAME_ADMIN_ROLE, account);
    }

    /**
     * @dev Transfer admin role from current admin to new admin
     * @param newAdmin Address of the new admin
     * Can only be called by current admin
     */
    function transferAdmin(
        address newAdmin
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmin != address(0), "MWG: New admin is zero address");
        require(newAdmin != _msgSender(), "MWG: New admin is current admin");

        // Grant admin role to new admin
        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);

        // Revoke admin role from current admin
        _revokeRole(DEFAULT_ADMIN_ROLE, _msgSender());

        emit AdminTransferred(_msgSender(), newAdmin);
    }
}
