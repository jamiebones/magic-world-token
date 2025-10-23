// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interfaces/IMagicWorldGems.sol";

/**
 * @title MagicWorldGame
 * @dev Game contract that manages Magic World Gems distribution for play-to-earn mechanics
 *
 * Features:
 * - Owns and manages the entire token supply
 * - Implements daily reward limits and anti-abuse mechanisms
 * - Role-based access for game servers and administrators
 * - Rate limiting for reward distribution
 * - Integration point for off-chain game servers
 */
contract MagicWorldGame is AccessControl, Pausable, ReentrancyGuard {
    // The Magic World Gems contract
    IMagicWorldGems public immutable magicWorldGems;

    // Role definitions
    bytes32 public constant GAME_ADMIN_ROLE = keccak256("GAME_ADMIN_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE =
        keccak256("REWARD_DISTRIBUTOR_ROLE");

    // Constants for time calculations
    uint256 private constant SECONDS_PER_HOUR = 3600;
    uint256 private constant SECONDS_PER_DAY = 86400;

    // Constants for percentage calculations
    uint256 private constant PERCENTAGE_BASE = 100;
    uint256 private constant PLAYER_TASKS_PERCENT = 50;
    uint256 private constant SOCIAL_FOLLOWERS_PERCENT = 5;
    uint256 private constant SOCIAL_POSTERS_PERCENT = 15;
    //uint256 private constant ECOSYSTEM_FUND_PERCENT = 30;

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
    // Distribution tracking
    mapping(uint256 => MerkleDistribution) public distributions;
    mapping(uint256 => mapping(address => uint256)) public claimed;

    // Player tracking
    mapping(address => uint256) public dailyRewardsReceived;
    mapping(address => uint256) public lastRewardDate;
    mapping(address => uint256) public lastMajorReward;
    mapping(address => uint256) public totalRewardsEarned;

    // Game statistics
    uint256 public totalRewardsDistributed;
    uint256 public totalPlayersRewarded;
    uint256 public currentDay;
    uint256 public nextDistributionId;

    // Rate limiting and anti-abuse
    uint256 public dailyRewardLimit = 1000 * 10 ** 18; // 1000 tokens per day per player
    uint256 public maxBatchSize = 200;
    uint256 public cooldownPeriod = SECONDS_PER_HOUR; // 1 hour minimum time between major rewards

    // Vault initialization tracking (bool packed last to potentially share slot)
    bool public vaultsInitialized;

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
     * @param _tokenAddress Address of the Magic World Gems contract
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

        magicWorldGems = IMagicWorldGems(_tokenAddress);

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
        magicWorldGems.batchTransfer(recipients, amounts);

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
        magicWorldGems.batchTransferEqual(recipients, amount);

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
            magicWorldGems.balanceOf(_msgSender()) >= amount,
            "MWG: Insufficient balance"
        );

        // Transfer tokens to this contract (effectively burning them)
        magicWorldGems.transferFrom(_msgSender(), address(this), amount);

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
            magicWorldGems.balanceOf(address(this)) >= amount,
            "MWG: Insufficient balance"
        );

        magicWorldGems.transfer(_msgSender(), amount);
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
            magicWorldGems.balanceOf(address(this))
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

    // ============================================
    // MERKLE DISTRIBUTION SYSTEM
    // ============================================

    /**
     * @dev Structure for Merkle-based token distributions
     * Allows users to claim tokens themselves using Merkle proofs
     *
     * Storage layout optimized for gas efficiency:
     * Slot 0: merkleRoot (32 bytes)
     * Slot 1: totalAllocated (32 bytes)
     * Slot 2: totalClaimed (32 bytes)
     * Slot 3: startTime (32 bytes)
     * Slot 4: endTime (32 bytes)
     * Slot 5: vaultType (1 byte) + finalized (1 byte) + 30 bytes free
     */
    struct MerkleDistribution {
        bytes32 merkleRoot; // Root of the Merkle tree
        uint256 totalAllocated; // Total tokens allocated for this distribution
        uint256 totalClaimed; // Total tokens claimed so far
        uint256 startTime; // When distribution becomes active
        uint256 endTime; // Expiration time (unclaimed returns to vault)
        AllocationType vaultType; // Which vault funded this distribution (uint8 enum)
        bool finalized; // Whether unclaimed tokens returned to vault
    }

    // Events for Merkle distributions
    event MerkleDistributionCreated(
        uint256 indexed distributionId,
        bytes32 merkleRoot,
        uint256 totalAllocated,
        AllocationType indexed vaultType,
        uint256 startTime,
        uint256 endTime
    );

    event TokensClaimed(
        uint256 indexed distributionId,
        address indexed user,
        uint256 amount,
        uint256 totalClaimed
    );

    event DistributionFinalized(
        uint256 indexed distributionId,
        uint256 unclaimedAmount,
        AllocationType indexed vaultType
    );

    /**
     * @dev Create a new Merkle-based distribution
     * @param merkleRoot Root hash of the Merkle tree
     * @param totalAllocated Total amount of tokens allocated for this distribution
     * @param vaultType Which vault to deduct tokens from
     * @param durationInDays How many days until distribution expires
     * @return distributionId The ID of the created distribution
     *
     * Requirements:
     * - Caller must have GAME_ADMIN_ROLE or DEFAULT_ADMIN_ROLE
     * - Vaults must be initialized
     * - Vault must have sufficient balance
     * - Duration must be at least 1 day
     *
     * Note: Tokens are immediately deducted from vault
     * Unclaimed tokens can be returned to vault after expiration via finalizeDistribution()
     */
    function setMerkleDistribution(
        bytes32 merkleRoot,
        uint256 totalAllocated,
        AllocationType vaultType,
        uint256 durationInDays
    ) external vaultsInitializedRequired returns (uint256 distributionId) {
        // Allow both GAME_ADMIN_ROLE and DEFAULT_ADMIN_ROLE
        require(
            hasRole(GAME_ADMIN_ROLE, _msgSender()) ||
                hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "MWG: Caller is not admin"
        );

        require(merkleRoot != bytes32(0), "MWG: Invalid merkle root");
        require(totalAllocated > 0, "MWG: Zero allocation");
        require(durationInDays >= 1, "MWG: Duration too short");

        // Check vault has sufficient balance
        require(
            vaults[vaultType].remaining >= totalAllocated,
            "MWG: Insufficient vault balance"
        );

        // Deduct from vault
        vaults[vaultType].spent += totalAllocated;
        vaults[vaultType].remaining -= totalAllocated;

        // Create distribution
        distributionId = nextDistributionId++;

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (durationInDays * SECONDS_PER_DAY);

        distributions[distributionId] = MerkleDistribution({
            merkleRoot: merkleRoot,
            totalAllocated: totalAllocated,
            totalClaimed: 0,
            startTime: startTime,
            endTime: endTime,
            vaultType: vaultType,
            finalized: false
        });

        emit MerkleDistributionCreated(
            distributionId,
            merkleRoot,
            totalAllocated,
            vaultType,
            startTime,
            endTime
        );
    }

    /**
     * @dev Claim tokens from a Merkle distribution
     * @param distributionId ID of the distribution to claim from
     * @param totalAmount User's total allocation in this distribution (from Merkle tree)
     * @param proof Merkle proof for verification
     *
     * Requirements:
     * - Distribution must exist and not be finalized
     * - Distribution must not be expired
     * - Merkle proof must be valid
     * - User must have unclaimed tokens
     *
     * Note:
     * - Bypasses daily limits (pre-approved allocation)
     * - Users can claim partially multiple times
     * - Leaf format: keccak256(abi.encodePacked(userAddress, totalAmount))
     */
    function claimFromMerkle(
        uint256 distributionId,
        uint256 totalAmount,
        bytes32[] calldata proof
    ) external nonReentrant whenNotPaused {
        MerkleDistribution storage distribution = distributions[distributionId];

        require(
            distribution.merkleRoot != bytes32(0),
            "MWG: Distribution does not exist"
        );
        require(!distribution.finalized, "MWG: Distribution finalized");
        require(
            block.timestamp < distribution.endTime,
            "MWG: Distribution expired"
        );
        require(
            block.timestamp >= distribution.startTime,
            "MWG: Distribution not started"
        );

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(_msgSender(), totalAmount));
        require(
            MerkleProof.verify(proof, distribution.merkleRoot, leaf),
            "MWG: Invalid proof"
        );

        // Calculate claimable amount
        uint256 alreadyClaimed = claimed[distributionId][_msgSender()];
        require(totalAmount > alreadyClaimed, "MWG: Nothing to claim");

        uint256 claimableAmount = totalAmount - alreadyClaimed;

        // Update claimed tracking
        claimed[distributionId][_msgSender()] = totalAmount;
        distribution.totalClaimed += claimableAmount;

        // Transfer tokens
        require(
            magicWorldGems.transfer(_msgSender(), claimableAmount),
            "MWG: Token transfer failed"
        );

        emit TokensClaimed(
            distributionId,
            _msgSender(),
            claimableAmount,
            totalAmount
        );
    }

    /**
     * @dev Finalize an expired distribution and return unclaimed tokens to vault
     * @param distributionId ID of the distribution to finalize
     *
     * Requirements:
     * - Distribution must exist
     * - Distribution must be expired
     * - Distribution must not already be finalized
     *
     * Note: Can be called by anyone after expiration
     * Unclaimed tokens are returned to the original vault
     */
    function finalizeDistribution(uint256 distributionId) external {
        MerkleDistribution storage distribution = distributions[distributionId];

        require(
            distribution.merkleRoot != bytes32(0),
            "MWG: Distribution does not exist"
        );
        require(!distribution.finalized, "MWG: Already finalized");
        require(
            block.timestamp >= distribution.endTime,
            "MWG: Not expired yet"
        );

        distribution.finalized = true;

        // Calculate unclaimed amount
        uint256 unclaimedAmount = distribution.totalAllocated -
            distribution.totalClaimed;

        // Return unclaimed tokens to vault
        if (unclaimedAmount > 0) {
            vaults[distribution.vaultType].remaining += unclaimedAmount;
            vaults[distribution.vaultType].spent -= unclaimedAmount;
        }

        emit DistributionFinalized(
            distributionId,
            unclaimedAmount,
            distribution.vaultType
        );
    }

    /**
     * @dev Get detailed information about a distribution
     * @param distributionId ID of the distribution
     * @return merkleRoot Root of the Merkle tree
     * @return totalAllocated Total tokens allocated
     * @return totalClaimed Total tokens claimed
     * @return startTime Distribution start time
     * @return endTime Distribution end time
     * @return vaultType Which vault funded this
     * @return finalized Whether distribution is finalized
     * @return isActive Whether distribution is currently active
     * @return unclaimedAmount Remaining unclaimed tokens
     */
    function getDistributionInfo(
        uint256 distributionId
    )
        external
        view
        returns (
            bytes32 merkleRoot,
            uint256 totalAllocated,
            uint256 totalClaimed,
            uint256 startTime,
            uint256 endTime,
            AllocationType vaultType,
            bool finalized,
            bool isActive,
            uint256 unclaimedAmount
        )
    {
        MerkleDistribution memory distribution = distributions[distributionId];

        bool active = !distribution.finalized &&
            block.timestamp >= distribution.startTime &&
            block.timestamp < distribution.endTime;

        uint256 unclaimed = distribution.totalAllocated -
            distribution.totalClaimed;

        return (
            distribution.merkleRoot,
            distribution.totalAllocated,
            distribution.totalClaimed,
            distribution.startTime,
            distribution.endTime,
            distribution.vaultType,
            distribution.finalized,
            active,
            unclaimed
        );
    }

    /**
     * @dev Get amount claimed by a user from a specific distribution
     * @param distributionId ID of the distribution
     * @param user Address of the user
     * @return Amount claimed by the user
     */
    function getClaimedAmount(
        uint256 distributionId,
        address user
    ) external view returns (uint256) {
        return claimed[distributionId][user];
    }

    /**
     * @dev Calculate claimable amount for a user (view function)
     * @param distributionId ID of the distribution
     * @param user Address of the user
     * @param totalAmount User's total allocation (from Merkle tree)
     * @param proof Merkle proof for verification
     * @return claimable Amount user can currently claim
     * @return isValid Whether the proof is valid
     */
    function getClaimableAmount(
        uint256 distributionId,
        address user,
        uint256 totalAmount,
        bytes32[] calldata proof
    ) external view returns (uint256 claimable, bool isValid) {
        MerkleDistribution memory distribution = distributions[distributionId];

        // Check if distribution is active
        if (
            distribution.merkleRoot == bytes32(0) ||
            distribution.finalized ||
            block.timestamp >= distribution.endTime ||
            block.timestamp < distribution.startTime
        ) {
            return (0, false);
        }

        // Verify proof
        bytes32 leaf = keccak256(abi.encodePacked(user, totalAmount));
        isValid = MerkleProof.verify(proof, distribution.merkleRoot, leaf);

        if (!isValid) {
            return (0, false);
        }

        // Calculate claimable
        uint256 alreadyClaimed = claimed[distributionId][user];
        if (totalAmount > alreadyClaimed) {
            claimable = totalAmount - alreadyClaimed;
        } else {
            claimable = 0;
        }

        return (claimable, true);
    }
}
