// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IMagicWorldToken
 * @dev Interface for the Magic World Token with batch operations and role-based access
 */
interface IMagicWorldToken is IERC20 {
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

    // Emergency controls
    function pause() external;

    function unpause() external;

    function paused() external view returns (bool);

    // Admin management
    function transferAdmin(address newAdmin) external;
}
