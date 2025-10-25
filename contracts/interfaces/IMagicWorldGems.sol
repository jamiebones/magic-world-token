// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IMagicWorldGems
 * @dev Interface for the Magic World Gems with batch operations and role-based access
 */
interface IMagicWorldGems is IERC20 {
    // Events
    event BatchTransfer(
        address indexed operator,
        uint256 totalAmount,
        uint256 recipientCount
    );
    event BatchTransferEqual(
        address indexed operator,
        address[] recipients,
        uint256 amount
    );

    // Role-based batch transfer functions
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external;

    function batchTransferEqual(
        address[] calldata recipients,
        uint256 amount
    ) external;

    // Role management
    function GAME_OPERATOR_ROLE() external view returns (bytes32);

    function PAUSE_ROLE() external view returns (bytes32);

    function BLACKLIST_MANAGER_ROLE() external view returns (bytes32);

    // Blacklist management
    function blacklistAddress(address account, string calldata reason) external;

    function blacklistAddresses(
        address[] calldata accounts,
        string calldata reason
    ) external;

    function requestUnblacklist(address account) external;

    function executeUnblacklist(address account) external;

    function cancelUnblacklistRequest(address account) external;

    function setUnblacklistTimelock(uint256 newTimelock) external;

    function isBlacklisted(address account) external view returns (bool);

    function getBlacklistInfo(
        address account
    )
        external
        view
        returns (
            bool blacklisted,
            uint256 blacklistedAt,
            uint256 unblacklistRequestTime
        );

    // Emergency controls
    function pause() external;

    function unpause() external;

    function paused() external view returns (bool);

    // Admin management
    function transferAdmin(address newAdmin) external;
}

// Note: EIP-2612 Permit functions (permit, nonces, DOMAIN_SEPARATOR)
// are inherited from ERC20Permit and don't need to be redeclared here
