// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IMagicWorldGems.sol";

/**
 * @title MagicWorldGems
 * @dev ERC20 token with batch operations and role-based access control for play-to-earn gaming
 *
 * Features:
 * - Fixed supply (no minting after deployment)
 * - Batch transfer operations for gas optimization
 * - Role-based access control for game operations
 * - Pausable for emergency situations
 * - EIP-2612 permit for gasless approvals
 */
contract MagicWorldGems is
    ERC20,
    ERC20Permit,
    AccessControl,
    Pausable,
    IMagicWorldGems
{
    // Role definitions
    bytes32 public constant GAME_OPERATOR_ROLE =
        keccak256("GAME_OPERATOR_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant BLACKLIST_MANAGER_ROLE =
        keccak256("BLACKLIST_MANAGER_ROLE");

    // Maximum batch size to prevent gas limit issues
    uint256 public constant MAX_BATCH_SIZE = 200;
    uint256 public constant MAX_BLACKLIST_BATCH_SIZE = 100;

    // Blacklist time-lock configuration
    uint256 public constant MIN_UNBLACKLIST_TIMELOCK = 1 days;
    uint256 public constant MAX_UNBLACKLIST_TIMELOCK = 30 days;
    uint256 public unblacklistTimelock = 3 days; // Default 3 days, configurable

    // Blacklist mappings
    mapping(address => bool) private _blacklisted;
    mapping(address => uint256) private _blacklistedAt;
    mapping(address => uint256) private _unblacklistRequestTime;

    // Events
    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );
    event AddressBlacklisted(
        address indexed account,
        address indexed by,
        uint256 timestamp,
        string reason
    );
    event AddressUnblacklisted(
        address indexed account,
        address indexed by,
        uint256 timestamp
    );
    event UnblacklistRequested(
        address indexed account,
        address indexed by,
        uint256 effectiveTime
    );
    event UnblacklistTimelockUpdated(
        uint256 oldTimelock,
        uint256 newTimelock,
        address indexed updatedBy
    );

    /**
     * @dev Constructor that mints the entire fixed supply to the deployer
     * @param name Token name (e.g., "Magic World Gems")
     * @param symbol Token symbol (e.g., "MWG")
     * @param totalSupply Total fixed supply of tokens (with decimals)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) ERC20Permit(name) {
        // Grant the deployer the default admin role
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // Grant pause role to deployer initially
        _grantRole(PAUSE_ROLE, _msgSender());

        // Grant blacklist manager role to deployer initially
        _grantRole(BLACKLIST_MANAGER_ROLE, _msgSender());

        // Mint entire supply to deployer (who will transfer to game contract)
        _mint(_msgSender(), totalSupply);
    }

    // ============================================
    // BLACKLIST MANAGEMENT
    // ============================================

    /**
     * @dev Add an address to the blacklist
     * @param account Address to blacklist
     * @param reason Reason for blacklisting (stored in event)
     *
     * Requirements:
     * - Caller must have BLACKLIST_MANAGER_ROLE or DEFAULT_ADMIN_ROLE
     * - Account must not be zero address
     * - Account must not already be blacklisted
     *
     * Note: Blacklisted addresses cannot send tokens but can receive them
     */
    function blacklistAddress(
        address account,
        string calldata reason
    ) external {
        require(
            hasRole(BLACKLIST_MANAGER_ROLE, _msgSender()) ||
                hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "MWG: Caller is not authorized"
        );
        require(account != address(0), "MWG: Cannot blacklist zero address");
        require(!_blacklisted[account], "MWG: Address already blacklisted");

        _blacklisted[account] = true;
        _blacklistedAt[account] = block.timestamp;

        // Cancel any pending unblacklist request
        _unblacklistRequestTime[account] = 0;

        emit AddressBlacklisted(account, _msgSender(), block.timestamp, reason);
    }

    /**
     * @dev Batch blacklist multiple addresses
     * @param accounts Array of addresses to blacklist
     * @param reason Reason for blacklisting (applied to all)
     *
     * Requirements:
     * - Caller must have BLACKLIST_MANAGER_ROLE or DEFAULT_ADMIN_ROLE
     * - Array must not be empty
     * - Array length must not exceed MAX_BLACKLIST_BATCH_SIZE (100)
     */
    function blacklistAddresses(
        address[] calldata accounts,
        string calldata reason
    ) external {
        require(
            hasRole(BLACKLIST_MANAGER_ROLE, _msgSender()) ||
                hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "MWG: Caller is not authorized"
        );
        require(accounts.length > 0, "MWG: Empty array");
        require(
            accounts.length <= MAX_BLACKLIST_BATCH_SIZE,
            "MWG: Batch size exceeds maximum"
        );
        uint256 i = 0;
        for (i; i < accounts.length; i++) {
            address account = accounts[i];
            // Skip zero address and already blacklisted
            if (account == address(0) || _blacklisted[account]) {
                continue;
            }
            _blacklisted[account] = true;
            _blacklistedAt[account] = block.timestamp;
            _unblacklistRequestTime[account] = 0;

            emit AddressBlacklisted(
                account,
                _msgSender(),
                block.timestamp,
                reason
            );
        }
    }

    /**
     * @dev Request to unblacklist an address (starts 3-day timelock)
     * @param account Address to unblacklist
     *
     * Requirements:
     * - Caller must have BLACKLIST_MANAGER_ROLE or DEFAULT_ADMIN_ROLE
     * - Account must be blacklisted
     * - No pending unblacklist request
     *
     * Note: Unblacklisting takes effect after 3 days
     */
    function requestUnblacklist(address account) external {
        require(
            hasRole(BLACKLIST_MANAGER_ROLE, _msgSender()) ||
                hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "MWG: Caller is not authorized"
        );
        require(_blacklisted[account], "MWG: Address not blacklisted");
        require(
            _unblacklistRequestTime[account] == 0,
            "MWG: Unblacklist already requested"
        );

        uint256 effectiveTime = block.timestamp + unblacklistTimelock;
        _unblacklistRequestTime[account] = effectiveTime;

        emit UnblacklistRequested(account, _msgSender(), effectiveTime);
    }

    /**
     * @dev Execute unblacklist after timelock period
     * @param account Address to unblacklist
     *
     * Requirements:
     * - Account must be blacklisted
     * - Unblacklist must have been requested
     * - Timelock period must have elapsed
     */
    function executeUnblacklist(address account) external {
        require(
            hasRole(BLACKLIST_MANAGER_ROLE, _msgSender()) ||
                hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "MWG: Caller is not authorized"
        );
        require(_blacklisted[account], "MWG: Address not blacklisted");
        require(
            _unblacklistRequestTime[account] > 0,
            "MWG: Unblacklist not requested"
        );
        require(
            block.timestamp >= _unblacklistRequestTime[account],
            "MWG: Timelock period not elapsed"
        );

        _blacklisted[account] = false;
        _blacklistedAt[account] = 0;
        _unblacklistRequestTime[account] = 0;

        emit AddressUnblacklisted(account, _msgSender(), block.timestamp);
    }

    /**
     * @dev Cancel a pending unblacklist request
     * @param account Address whose unblacklist request to cancel
     *
     * Requirements:
     * - Caller must have BLACKLIST_MANAGER_ROLE or DEFAULT_ADMIN_ROLE
     * - Account must have a pending unblacklist request
     */
    function cancelUnblacklistRequest(address account) external {
        require(
            hasRole(BLACKLIST_MANAGER_ROLE, _msgSender()) ||
                hasRole(DEFAULT_ADMIN_ROLE, _msgSender()),
            "MWG: Caller is not authorized"
        );
        require(
            _unblacklistRequestTime[account] > 0,
            "MWG: No pending unblacklist request"
        );

        _unblacklistRequestTime[account] = 0;
    }

    /**
     * @dev Update the unblacklist timelock period
     * @param newTimelock New timelock period in seconds
     *
     * Requirements:
     * - Caller must have DEFAULT_ADMIN_ROLE
     * - New timelock must be between MIN_UNBLACKLIST_TIMELOCK and MAX_UNBLACKLIST_TIMELOCK
     *
     * Note: Does not affect already pending unblacklist requests
     */
    function setUnblacklistTimelock(
        uint256 newTimelock
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            newTimelock >= MIN_UNBLACKLIST_TIMELOCK,
            "MWG: Timelock too short"
        );
        require(
            newTimelock <= MAX_UNBLACKLIST_TIMELOCK,
            "MWG: Timelock too long"
        );

        uint256 oldTimelock = unblacklistTimelock;
        unblacklistTimelock = newTimelock;

        emit UnblacklistTimelockUpdated(oldTimelock, newTimelock, _msgSender());
    }

    /**
     * @dev Check if an address is blacklisted
     * @param account Address to check
     * @return bool True if blacklisted
     */
    function isBlacklisted(address account) external view returns (bool) {
        return _blacklisted[account];
    }

    /**
     * @dev Get blacklist information for an address
     * @param account Address to check
     * @return blacklisted Whether the address is blacklisted
     * @return blacklistedAt Timestamp when blacklisted (0 if not blacklisted)
     * @return unblacklistRequestTime Time when unblacklist becomes effective (0 if no request)
     */
    function getBlacklistInfo(
        address account
    )
        external
        view
        returns (
            bool blacklisted,
            uint256 blacklistedAt,
            uint256 unblacklistRequestTime
        )
    {
        return (
            _blacklisted[account],
            _blacklistedAt[account],
            _unblacklistRequestTime[account]
        );
    }

    // ============================================
    // BATCH TRANSFER FUNCTIONS
    // ============================================

    /**
     * @dev Batch transfer different amounts to multiple recipients
     * @param recipients Array of recipient addresses (must be unique)
     * @param amounts Array of amounts to transfer (must match recipients length)
     *
     * Requirements:
     * - Caller must have GAME_OPERATOR_ROLE
     * - Contract must not be paused
     * - Arrays must have matching lengths
     * - Recipients array must not be empty
     * - Recipients array must not exceed MAX_BATCH_SIZE
     * - No recipient can be the zero address
     * - No duplicate recipients allowed
     * - All amounts must be greater than zero
     * - Caller must have sufficient balance
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyRole(GAME_OPERATOR_ROLE) whenNotPaused {
        require(
            recipients.length == amounts.length,
            "MWG: Array length mismatch"
        );
        require(recipients.length > 0, "MWG: Empty arrays");
        require(
            recipients.length <= MAX_BATCH_SIZE,
            "MWG: Batch size too large"
        );

        uint256 totalAmount = 0;

        //come back to this: loop within a loop is a no no:

        // Calculate total amount and perform transfers with validation
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            require(amounts[i] > 0, "MWG: Zero amount transfer");
            // Check for duplicate recipients
            for (uint256 j = i + 1; j < recipients.length; j++) {
                require(recipients[j] != recipient, "MWG: Duplicate recipient");
            }

            totalAmount += amounts[i];
            _transfer(_msgSender(), recipient, amounts[i]);
        }

        emit BatchTransfer(_msgSender(), totalAmount, recipients.length);
    }

    /**
     * @dev Batch transfer same amount to multiple recipients
     * @param recipients Array of recipient addresses (must be unique)
     * @param amount Amount to transfer to each recipient
     *
     * Requirements:
     * - Caller must have GAME_OPERATOR_ROLE
     * - Contract must not be paused
     * - Recipients array must not be empty
     * - Recipients array must not exceed MAX_BATCH_SIZE
     * - No recipient can be the zero address
     * - No duplicate recipients allowed
     * - Amount must be greater than zero
     * - Caller must have sufficient balance for total transfer
     */
    function batchTransferEqual(
        address[] calldata recipients,
        uint256 amount
    ) external onlyRole(GAME_OPERATOR_ROLE) whenNotPaused {
        require(recipients.length > 0, "MWG: Empty recipients array");
        require(
            recipients.length <= MAX_BATCH_SIZE,
            "MWG: Batch size too large"
        );
        require(amount > 0, "MWG: Zero amount transfer");

        uint256 totalAmount = amount * recipients.length;
        require(
            balanceOf(_msgSender()) >= totalAmount,
            "MWG: Insufficient balance"
        );

        // Validate recipients and perform transfers
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];

            // Check for duplicate recipients
            for (uint256 j = i + 1; j < recipients.length; j++) {
                require(recipients[j] != recipient, "MWG: Duplicate recipient");
            }

            _transfer(_msgSender(), recipient, amount);
        }

        emit BatchTransferEqual(_msgSender(), recipients, amount);
    }

    /**
     * @dev Pause all token transfers (emergency function)
     * Can only be called by accounts with PAUSE_ROLE
     *
     * Requirements:
     * - Caller must have PAUSE_ROLE
     * - Contract must not already be paused
     *
     * Emits a {Paused} event
     */
    function pause() external onlyRole(PAUSE_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     * Can only be called by accounts with PAUSE_ROLE
     *
     * Requirements:
     * - Caller must have PAUSE_ROLE
     * - Contract must be paused
     *
     * Emits an {Unpaused} event
     */
    function unpause() external onlyRole(PAUSE_ROLE) {
        _unpause();
    }

    /**
     * @dev Override transfer to respect pause state and allow burning to zero address
     * @param to Recipient address (can be zero for burning)
     * @param amount Amount of tokens to transfer
     * @return bool Returns true if transfer succeeded
     *
     * Requirements:
     * - Contract must not be paused
     */
    function transfer(
        address to,
        uint256 amount
    ) public virtual override(ERC20, IERC20) whenNotPaused returns (bool) {
        // Allow transfers to zero address for token burning
        return super.transfer(to, amount);
    }

    /**
     * @dev Override transferFrom to respect pause state and allow burning to zero address
     * @param from Sender address
     * @param to Recipient address (can be zero for burning)
     * @param amount Amount of tokens to transfer
     * @return bool Returns true if transfer succeeded
     *
     * Requirements:
     * - Contract must not be paused
     * - Caller must have sufficient allowance
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override(ERC20, IERC20) whenNotPaused returns (bool) {
        // Allow transfers to zero address for token burning
        return super.transferFrom(from, to, amount);
    }

    /**
     * @dev Override paused function to resolve inheritance conflict
     */
    function paused()
        public
        view
        virtual
        override(Pausable, IMagicWorldGems)
        returns (bool)
    {
        return super.paused();
    }

    /**
     * @dev Override _update to add blacklist check
     * @param from Sender address
     * @param to Recipient address
     * @param value Amount of tokens
     *
     * Requirements:
     * - Sender (from) must not be blacklisted
     *
     * Note: Blacklisted addresses can receive tokens but cannot send them
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // Check if sender is blacklisted (only block sending, not receiving)
        // Skip check for minting (from == address(0))
        if (from != address(0)) {
            require(!_blacklisted[from], "MWG: Sender address is blacklisted");
        }

        super._update(from, to, value);
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
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

    /**
     * @dev Returns the current maximum batch size
     */
    function getMaxBatchSize() external pure returns (uint256) {
        return MAX_BATCH_SIZE;
    }
}
