// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PartnerVault
 * @dev Time-locked vault for partner token allocations
 *
 * Partners can withdraw their allocated tokens after a 3-year lockup period.
 * The contract includes emergency withdrawal functionality for admins when paused.
 *
 * Security Features:
 * - Time-locked withdrawals (3 years)
 * - ReentrancyGuard for withdrawal protection
 * - Pausable for emergency situations
 * - Role-based access control
 */
contract PartnerVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    IERC20 public immutable token;

    struct PartnerAllocation {
        uint256 amount;
        uint256 allocatedAt;
        bool withdrawn;
    }

    mapping(address => PartnerAllocation) public partnerAllocations;
    address[] private partnerAddresses;

    uint256 public constant LOCKUP_PERIOD = 3 * 365 days; // 3 years
    uint256 public totalAllocated;

    event PartnerAllocated(
        address indexed partner,
        uint256 amount,
        uint256 timestamp
    );
    event PartnerWithdrawn(
        address indexed partner,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev Constructor sets up the vault with token reference
     * @param _token Address of the ERC20 token contract
     *
     * Requirements:
     * - Token address must not be zero
     *
     * Effects:
     * - Grants DEFAULT_ADMIN_ROLE and ADMIN_ROLE to deployer
     */
    constructor(address _token) {
        require(_token != address(0), "Invalid token address");

        token = IERC20(_token);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Allocate tokens to a partner
     * @param partner Partner's address
     * @param amount Amount of tokens to allocate
     */
    function allocateToPartner(
        address partner,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        require(partner != address(0), "Invalid partner address");
        require(amount > 0, "Amount must be greater than 0");
        require(
            partnerAllocations[partner].amount == 0,
            "Partner already allocated"
        );

        partnerAllocations[partner] = PartnerAllocation({
            amount: amount,
            allocatedAt: block.timestamp,
            withdrawn: false
        });

        partnerAddresses.push(partner);
        totalAllocated += amount;

        emit PartnerAllocated(partner, amount, block.timestamp);
    }

    /**
     * @dev Batch allocate tokens to multiple partners
     * @param partners Array of partner addresses
     * @param amounts Array of token amounts (must match partners length)
     *
     * Requirements:
     * - Caller must have ADMIN_ROLE
     * - Contract must not be paused
     * - Arrays must have the same length
     * - Arrays must not be empty
     * - All partners must be valid addresses
     * - All amounts must be greater than 0
     * - Partners must not already have allocations
     *
     * Effects:
     * - Allocates tokens to all partners with 3-year lockup
     * - Updates totalAllocated
     * - Adds partners to partnerAddresses array
     * - Emits PartnerAllocated event for each partner
     */
    function batchAllocateToPartners(
        address[] calldata partners,
        uint256[] calldata amounts
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        require(partners.length > 0, "Empty arrays");
        require(partners.length == amounts.length, "Array length mismatch");

        uint256 totalAmount = 0;

        for (uint256 i = 0; i < partners.length; i++) {
            address partner = partners[i];
            uint256 amount = amounts[i];

            require(partner != address(0), "Invalid partner address");
            require(amount > 0, "Amount must be greater than 0");
            require(
                partnerAllocations[partner].amount == 0,
                "Partner already allocated"
            );

            partnerAllocations[partner] = PartnerAllocation({
                amount: amount,
                allocatedAt: block.timestamp,
                withdrawn: false
            });

            partnerAddresses.push(partner);
            totalAmount += amount;

            emit PartnerAllocated(partner, amount, block.timestamp);
        }

        totalAllocated += totalAmount;
    }

    /**
     * @dev Partner can withdraw their allocated tokens after lockup period
     */
    function withdraw() external nonReentrant whenNotPaused {
        PartnerAllocation storage allocation = partnerAllocations[msg.sender];

        require(allocation.amount > 0, "No allocation found");
        require(!allocation.withdrawn, "Already withdrawn");
        require(
            block.timestamp >= allocation.allocatedAt + LOCKUP_PERIOD,
            "Lockup period not ended"
        );

        allocation.withdrawn = true;

        require(
            token.balanceOf(address(this)) >= allocation.amount,
            "Insufficient vault balance"
        );

        token.safeTransfer(msg.sender, allocation.amount);

        emit PartnerWithdrawn(msg.sender, allocation.amount, block.timestamp);
    }

    /**
     * @dev Get partner's allocation details
     * @param partner Partner's address
     */
    function getPartnerAllocation(
        address partner
    )
        external
        view
        returns (
            uint256 amount,
            uint256 allocatedAt,
            bool withdrawn,
            uint256 withdrawableAt
        )
    {
        PartnerAllocation memory allocation = partnerAllocations[partner];
        return (
            allocation.amount,
            allocation.allocatedAt,
            allocation.withdrawn,
            allocation.allocatedAt + LOCKUP_PERIOD
        );
    }

    /**
     * @dev Get partner's withdrawable amount (0 if not eligible)
     * @param partner Partner's address
     */
    function getWithdrawableAmount(
        address partner
    ) external view returns (uint256) {
        PartnerAllocation memory allocation = partnerAllocations[partner];

        if (allocation.amount == 0 || allocation.withdrawn) {
            return 0;
        }

        if (block.timestamp >= allocation.allocatedAt + LOCKUP_PERIOD) {
            return allocation.amount;
        }

        return 0;
    }

    /**
     * @dev Emergency withdraw function for admin (only if contract is paused)
     * @param partner Partner's address
     */
    function emergencyWithdraw(
        address partner
    ) external onlyRole(ADMIN_ROLE) whenPaused {
        PartnerAllocation storage allocation = partnerAllocations[partner];

        require(allocation.amount > 0, "No allocation found");
        require(!allocation.withdrawn, "Already withdrawn");

        allocation.withdrawn = true;

        token.safeTransfer(partner, allocation.amount);

        emit PartnerWithdrawn(partner, allocation.amount, block.timestamp);
    }

    /**
     * @dev Pause the contract (admin only)
     *
     * Requirements:
     * - Caller must have ADMIN_ROLE
     * - Contract must not already be paused
     *
     * Effects:
     * - Prevents partner withdrawals
     * - Prevents new allocations
     * - Enables emergency withdrawals by admin
     *
     * Emits a {Paused} event
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract (admin only)
     *
     * Requirements:
     * - Caller must have ADMIN_ROLE
     * - Contract must be paused
     *
     * Effects:
     * - Re-enables partner withdrawals
     * - Re-enables new allocations
     * - Disables emergency withdrawals
     *
     * Emits an {Unpaused} event
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Get total allocated tokens across all partners
     * @return uint256 Total amount of tokens allocated to all partners
     */
    function getTotalAllocated() external view returns (uint256) {
        return totalAllocated;
    }

    /**
     * @dev Get current token balance held by the vault
     * @return uint256 Current balance of tokens in the vault contract
     *
     * Note: This may be greater than totalAllocated if additional tokens are transferred
     */
    function getVaultBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Get list of all partner addresses
     * @return address[] Array of all partner addresses that have allocations
     */
    function getAllPartners() external view returns (address[] memory) {
        return partnerAddresses;
    }

    /**
     * @dev Get total number of partners
     * @return uint256 Total count of partners with allocations
     */
    function getPartnerCount() external view returns (uint256) {
        return partnerAddresses.length;
    }

    /**
     * @dev Get paginated list of partners with their allocation details
     * @param offset Starting index for pagination
     * @param limit Maximum number of partners to return
     * @return partners Array of partner addresses
     * @return amounts Array of allocation amounts
     * @return allocatedAts Array of allocation timestamps
     * @return withdrawns Array of withdrawal status
     * @return withdrawableAts Array of withdrawal eligibility timestamps
     */
    function getPartnersWithDetails(
        uint256 offset,
        uint256 limit
    )
        external
        view
        returns (
            address[] memory partners,
            uint256[] memory amounts,
            uint256[] memory allocatedAts,
            bool[] memory withdrawns,
            uint256[] memory withdrawableAts
        )
    {
        uint256 total = partnerAddresses.length;

        // Handle edge cases
        if (offset >= total) {
            return (
                new address[](0),
                new uint256[](0),
                new uint256[](0),
                new bool[](0),
                new uint256[](0)
            );
        }

        // Calculate actual number of items to return
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 resultLength = end - offset;

        // Initialize arrays
        partners = new address[](resultLength);
        amounts = new uint256[](resultLength);
        allocatedAts = new uint256[](resultLength);
        withdrawns = new bool[](resultLength);
        withdrawableAts = new uint256[](resultLength);

        // Fill arrays with data
        for (uint256 i = 0; i < resultLength; i++) {
            address partner = partnerAddresses[offset + i];
            PartnerAllocation memory allocation = partnerAllocations[partner];

            partners[i] = partner;
            amounts[i] = allocation.amount;
            allocatedAts[i] = allocation.allocatedAt;
            withdrawns[i] = allocation.withdrawn;
            withdrawableAts[i] = allocation.allocatedAt + LOCKUP_PERIOD;
        }

        return (partners, amounts, allocatedAts, withdrawns, withdrawableAts);
    }
}
