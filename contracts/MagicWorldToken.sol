// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IMagicWorldToken.sol";

/**
 * @title MagicWorldToken
 * @dev ERC20 token with batch operations and role-based access control for play-to-earn gaming
 *
 * Features:
 * - Fixed supply (no minting after deployment)
 * - Batch transfer operations for gas optimization
 * - Role-based access control for game operations
 * - Pausable for emergency situations
 */
contract MagicWorldToken is ERC20, AccessControl, Pausable, IMagicWorldToken {
    // Role definitions
    bytes32 public constant GAME_OPERATOR_ROLE =
        keccak256("GAME_OPERATOR_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

    // Maximum batch size to prevent gas limit issues
    uint256 public constant MAX_BATCH_SIZE = 200;

    // Events
    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );

    /**
     * @dev Constructor that mints the entire fixed supply to the deployer
     * @param name Token name (e.g., "Magic World Token")
     * @param symbol Token symbol (e.g., "MWT")
     * @param totalSupply Total fixed supply of tokens (with decimals)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) {
        // Grant the deployer the default admin role
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // Grant pause role to deployer initially
        _grantRole(PAUSE_ROLE, _msgSender());

        // Mint entire supply to deployer (who will transfer to game contract)
        _mint(_msgSender(), totalSupply);
    }

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
            "MWT: Array length mismatch"
        );
        require(recipients.length > 0, "MWT: Empty arrays");
        require(
            recipients.length <= MAX_BATCH_SIZE,
            "MWT: Batch size too large"
        );

        uint256 totalAmount = 0;

        // Calculate total amount and perform transfers with validation
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];

            require(amounts[i] > 0, "MWT: Zero amount transfer");

            // Check for duplicate recipients
            for (uint256 j = i + 1; j < recipients.length; j++) {
                require(recipients[j] != recipient, "MWT: Duplicate recipient");
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
        require(recipients.length > 0, "MWT: Empty recipients array");
        require(
            recipients.length <= MAX_BATCH_SIZE,
            "MWT: Batch size too large"
        );
        require(amount > 0, "MWT: Zero amount transfer");

        uint256 totalAmount = amount * recipients.length;
        require(
            balanceOf(_msgSender()) >= totalAmount,
            "MWT: Insufficient balance"
        );

        // Validate recipients and perform transfers
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];

            // Check for duplicate recipients
            for (uint256 j = i + 1; j < recipients.length; j++) {
                require(recipients[j] != recipient, "MWT: Duplicate recipient");
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
        override(Pausable, IMagicWorldToken)
        returns (bool)
    {
        return super.paused();
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
        require(newAdmin != address(0), "MWT: New admin is zero address");
        require(newAdmin != _msgSender(), "MWT: New admin is current admin");

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
