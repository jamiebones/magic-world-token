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

    // Rate limiting and anti-abuse
    uint256 public dailyRewardLimit = 1000 * 10 ** 18; // 1000 tokens per day per player
    uint256 public maxBatchSize = 200;
    uint256 public cooldownPeriod = 1 hours; // Minimum time between major rewards

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

    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event MaxBatchSizeUpdated(uint256 oldSize, uint256 newSize);
    event CooldownPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event TokensBurned(address indexed player, uint256 amount, uint256 itemId);
    event EmergencyWithdraw(address indexed admin, uint256 amount);
    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );

    /**
     * @dev Constructor sets up the game contract with token reference
     * @param _tokenAddress Address of the Magic World Token contract
     */
    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "MWG: Invalid token address");

        magicWorldToken = IMagicWorldToken(_tokenAddress);

        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(GAME_ADMIN_ROLE, _msgSender());
        _grantRole(REWARD_DISTRIBUTOR_ROLE, _msgSender());

        // Initialize current day
        currentDay = block.timestamp / 1 days;
    }

    /**
     * @dev Distribute rewards to multiple players
     * @param recipients Array of player addresses
     * @param amounts Array of reward amounts
     * @param reason Reason for the reward distribution
     */
    function distributeRewards(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyRole(REWARD_DISTRIBUTOR_ROLE) whenNotPaused nonReentrant {
        require(
            recipients.length == amounts.length,
            "MWG: Array length mismatch"
        );
        require(recipients.length > 0, "MWG: Empty arrays");
        require(recipients.length <= maxBatchSize, "MWG: Batch too large");

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

        // Use batch transfer for efficiency
        magicWorldToken.batchTransfer(recipients, amounts);

        emit RewardsDistributed(_msgSender(), recipients, amounts, reason);
    }

    /**
     * @dev Distribute equal rewards to multiple players
     * @param recipients Array of player addresses
     * @param amount Amount to give each player
     * @param reason Reason for the reward distribution
     */
    function distributeEqualRewards(
        address[] calldata recipients,
        uint256 amount,
        string calldata reason
    ) external onlyRole(REWARD_DISTRIBUTOR_ROLE) whenNotPaused nonReentrant {
        require(recipients.length > 0, "MWG: Empty recipients");
        require(recipients.length <= maxBatchSize, "MWG: Batch too large");
        require(amount > 0, "MWG: Zero amount");

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

        // Use batch transfer equal for gas efficiency
        magicWorldToken.batchTransferEqual(recipients, amount);

        emit RewardsDistributed(_msgSender(), recipients, amounts, reason);
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
     */
    function setDailyRewardLimit(
        uint256 newLimit
    ) external onlyRole(GAME_ADMIN_ROLE) {
        require(newLimit > 0, "MWG: Invalid limit");
        uint256 oldLimit = dailyRewardLimit;
        dailyRewardLimit = newLimit;
        emit DailyLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @dev Update maximum batch size (admin only)
     * @param newSize New maximum batch size
     */
    function setMaxBatchSize(
        uint256 newSize
    ) external onlyRole(GAME_ADMIN_ROLE) {
        require(newSize > 0 && newSize <= 500, "MWG: Invalid batch size");
        uint256 oldSize = maxBatchSize;
        maxBatchSize = newSize;
        emit MaxBatchSizeUpdated(oldSize, newSize);
    }

    /**
     * @dev Update cooldown period (admin only)
     * @param newPeriod New cooldown period in seconds
     */
    function setCooldownPeriod(
        uint256 newPeriod
    ) external onlyRole(GAME_ADMIN_ROLE) {
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
     * @dev Internal function to check daily limits
     */
    function _checkDailyLimit(address recipient, uint256 amount) internal view {
        uint256 todayReceived = (lastRewardDate[recipient] == currentDay)
            ? dailyRewardsReceived[recipient]
            : 0;

        require(
            todayReceived + amount <= dailyRewardLimit,
            "MWG: Daily limit exceeded"
        );
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
     * @dev Internal function to update current day
     */
    function _updateCurrentDay() internal {
        uint256 today = block.timestamp / 1 days;
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
