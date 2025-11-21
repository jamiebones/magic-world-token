// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MWGOrderBook
 * @notice Order book system for exchanging MWG tokens for BNB without AMM slippage
 * @dev Primary flow: Clients create SELL orders (deposit MWG, want BNB), Admin fills with BNB
 * 
 * Primary Flow:
 * 1. Client creates SELL order (deposits MWG, wants BNB)
 * 2. Admin sees order and fills it (sends BNB, receives MWG)
 * 3. Client receives BNB payment
 * 
 * Features:
 * - Anyone can create BUY or SELL orders
 * - Partial fills supported
 * - Time-based expiration
 * - Order cancellation with fund return
 * - Pause functionality for emergencies
 * - Minimum order amounts to prevent spam
 */
contract MWGOrderBook is ReentrancyGuard, Pausable, AccessControl {
    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice MWG token contract
    IERC20 public immutable mwgToken;

    /// @notice Counter for order IDs
    uint256 private _orderIdCounter;

    /// @notice Minimum MWG amount per order (100 MWG)
    uint256 public minMWGAmount = 100 * 10**18;

    /// @notice Minimum BNB amount per order (0.0001 BNB)
    uint256 public minBNBAmount = 0.0001 ether;

    /// @notice Maximum order expiration time (30 days)
    uint256 public constant MAX_EXPIRY = 30 days;

    /// @notice Fee percentage (in basis points, 0 = no fee)
    uint256 public feePercentage = 0; // 0 basis points = 0%

    /// @notice Fee recipient address
    address public feeRecipient;

    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice Pending BNB withdrawals (pull-over-push pattern)
    mapping(address => uint256) public pendingWithdrawals;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

    // =============================================================================
    // Data Structures
    // =============================================================================

    enum OrderType { BUY, SELL }
    enum OrderStatus { ACTIVE, FILLED, PARTIALLY_FILLED, CANCELLED, EXPIRED }

    struct Order {
        uint256 orderId;
        address user;
        OrderType orderType;
        uint256 mwgAmount;      // Total MWG amount
        uint256 bnbAmount;      // Total BNB amount
        uint256 price;          // Price per MWG in wei (bnbAmount * 1e18 / mwgAmount)
        uint256 filled;         // Amount filled so far
        uint256 remaining;      // Amount remaining
        OrderStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 feeAtCreation;  // Fee percentage when order was created
    }

    struct Fill {
        uint256 fillId;
        uint256 orderId;
        address filler;
        uint256 mwgAmount;
        uint256 bnbAmount;
        uint256 timestamp;
    }

    // =============================================================================
    // Storage
    // =============================================================================

    /// @notice Mapping of order ID to Order
    mapping(uint256 => Order) public orders;

    /// @notice Mapping of user address to their order IDs
    mapping(address => uint256[]) public userOrders;

    /// @notice Array of active BUY order IDs
    uint256[] public activeBuyOrders;

    /// @notice Array of active SELL order IDs
    uint256[] public activeSellOrders;

    /// @notice Mapping of order ID to fill history
    mapping(uint256 => Fill[]) public orderFills;

    /// @notice Counter for fill IDs
    uint256 private _fillIdCounter;

    // =============================================================================
    // Events
    // =============================================================================

    event OrderCreated(
        uint256 indexed orderId,
        address indexed user,
        OrderType orderType,
        uint256 mwgAmount,
        uint256 bnbAmount,
        uint256 price,
        uint256 expiresAt
    );

    event OrderFilled(
        uint256 indexed orderId,
        uint256 indexed fillId,
        address indexed filler,
        uint256 mwgAmount,
        uint256 bnbAmount,
        OrderStatus newStatus
    );

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed user,
        uint256 bnbRefund,
        uint256 mwgRefund
    );

    event OrderExpired(uint256 indexed orderId);

    event MinimumAmountsUpdated(uint256 minMWG, uint256 minBNB);

    event FeeUpdated(uint256 newFeePercentage, address newFeeRecipient);

    event WithdrawalClaimed(address indexed user, uint256 amount);

    // =============================================================================
    // Constructor
    // =============================================================================

    /**
     * @notice Initialize the order book
     * @param _mwgToken Address of the MWG token contract
     * @param _admin Address of the admin
     */
    constructor(address _mwgToken, address _admin) {
        require(_mwgToken != address(0), "Invalid MWG token address");
        require(_admin != address(0), "Invalid admin address");

        mwgToken = IERC20(_mwgToken);
        feeRecipient = _admin;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(PAUSE_ROLE, _admin);
    }

    // =============================================================================
    // Order Creation Functions
    // =============================================================================

    /**
     * @notice Create a BUY order (deposit BNB, want MWG)
     * @param mwgAmount Amount of MWG desired
     * @param pricePerMWG Price per MWG in wei
     * @param expirySeconds Time until order expires (in seconds)
     * @return orderId The ID of the created order
     */
    function createBuyOrder(
        uint256 mwgAmount,
        uint256 pricePerMWG,
        uint256 expirySeconds
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(mwgAmount >= minMWGAmount, "MWG amount below minimum");
        require(pricePerMWG > 0, "Price must be greater than 0");
        require(expirySeconds > 0 && expirySeconds <= MAX_EXPIRY, "Invalid expiry time");

        uint256 bnbAmount = (mwgAmount * pricePerMWG) / 1e18;
        require(bnbAmount >= minBNBAmount, "BNB amount below minimum");
        require(msg.value == bnbAmount, "Incorrect BNB amount sent");

        uint256 orderId = ++_orderIdCounter;

        Order storage order = orders[orderId];
        order.orderId = orderId;
        order.user = msg.sender;
        order.orderType = OrderType.BUY;
        order.mwgAmount = mwgAmount;
        order.bnbAmount = bnbAmount;
        order.price = pricePerMWG;
        order.filled = 0;
        order.remaining = mwgAmount;
        order.status = OrderStatus.ACTIVE;
        order.createdAt = block.timestamp;
        order.expiresAt = block.timestamp + expirySeconds;
        order.feeAtCreation = feePercentage;

        userOrders[msg.sender].push(orderId);
        activeBuyOrders.push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            OrderType.BUY,
            mwgAmount,
            bnbAmount,
            pricePerMWG,
            order.expiresAt
        );

        return orderId;
    }

    /**
     * @notice Create a SELL order (deposit MWG, want BNB) - Primary use case for clients
     * @dev Client deposits MWG, admin fills with BNB. Anyone can create this order.
     * @param mwgAmount Amount of MWG to sell
     * @param pricePerMWG Price per MWG in wei
     * @param expirySeconds Time until order expires (in seconds)
     * @return orderId The ID of the created order
     */
    function createSellOrder(
        uint256 mwgAmount,
        uint256 pricePerMWG,
        uint256 expirySeconds
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(mwgAmount >= minMWGAmount, "MWG amount below minimum");
        require(pricePerMWG > 0, "Price must be greater than 0");
        require(expirySeconds > 0 && expirySeconds <= MAX_EXPIRY, "Invalid expiry time");

        uint256 bnbAmount = (mwgAmount * pricePerMWG) / 1e18;
        require(bnbAmount >= minBNBAmount, "BNB amount below minimum");

        // Transfer MWG from user to contract
        require(
            mwgToken.transferFrom(msg.sender, address(this), mwgAmount),
            "MWG transfer failed"
        );

        uint256 orderId = ++_orderIdCounter;

        Order storage order = orders[orderId];
        order.orderId = orderId;
        order.user = msg.sender;
        order.orderType = OrderType.SELL;
        order.mwgAmount = mwgAmount;
        order.bnbAmount = bnbAmount;
        order.price = pricePerMWG;
        order.filled = 0;
        order.remaining = mwgAmount;
        order.status = OrderStatus.ACTIVE;
        order.createdAt = block.timestamp;
        order.expiresAt = block.timestamp + expirySeconds;
        order.feeAtCreation = feePercentage;

        userOrders[msg.sender].push(orderId);
        activeSellOrders.push(orderId);

        emit OrderCreated(
            orderId,
            msg.sender,
            OrderType.SELL,
            mwgAmount,
            bnbAmount,
            pricePerMWG,
            order.expiresAt
        );

        return orderId;
    }

    // =============================================================================
    // Order Filling Functions
    // =============================================================================

    /**
     * @notice Fill a BUY order (send MWG, receive BNB) 
     * @dev Typically used when client fills admin's buy order
     * @param orderId The ID of the order to fill
     * @param mwgAmount Amount of MWG to send (can be partial)
     */
    function fillBuyOrder(uint256 orderId, uint256 mwgAmount)
        external
        nonReentrant
        whenNotPaused
    {
        Order storage order = orders[orderId];
        
        require(order.orderId != 0, "Order does not exist");
        require(order.orderType == OrderType.BUY, "Not a buy order");
        require(
            order.status == OrderStatus.ACTIVE || order.status == OrderStatus.PARTIALLY_FILLED,
            "Order not active"
        );
        require(block.timestamp < order.expiresAt, "Order expired");
        require(msg.sender != order.user, "Cannot fill own order");
        require(mwgAmount > 0, "Amount must be greater than 0");
        require(mwgAmount <= order.remaining, "Amount exceeds remaining");

        // Calculate BNB to transfer
        uint256 bnbAmount = (mwgAmount * order.price) / 1e18;
        require(bnbAmount > 0, "Fill amount rounds to zero");

        // Calculate fee using fee at order creation (prevents retroactive changes)
        uint256 fee = (bnbAmount * order.feeAtCreation) / 10000;
        uint256 bnbToFiller = bnbAmount - fee;

        // EFFECTS: Update order state
        order.filled += mwgAmount;
        order.remaining -= mwgAmount;

        // Update status
        if (order.remaining == 0) {
            order.status = OrderStatus.FILLED;
            _removeFromActiveOrders(orderId, OrderType.BUY);
        } else {
            order.status = OrderStatus.PARTIALLY_FILLED;
        }

        // Record fill
        uint256 fillId = ++_fillIdCounter;
        
        orderFills[orderId].push(Fill({
            fillId: fillId,
            orderId: orderId,
            filler: msg.sender,
            mwgAmount: mwgAmount,
            bnbAmount: bnbAmount,
            timestamp: block.timestamp
        }));

        emit OrderFilled(orderId, fillId, msg.sender, mwgAmount, bnbAmount, order.status);
        require(
            mwgToken.transferFrom(msg.sender, order.user, mwgAmount),
            "MWG transfer failed"
        );

        // Use pull-over-push pattern to prevent locked BNB
        pendingWithdrawals[msg.sender] += bnbToFiller;
        
        if (fee > 0) {
            pendingWithdrawals[feeRecipient] += fee;
        }
    }

    /**
     * @notice Fill a SELL order (send BNB, receive MWG) - PRIMARY ADMIN FUNCTION
     * @dev Admin fills client's sell order. Client deposited MWG, wants BNB.
     * @param orderId The ID of the order to fill
     * @param mwgAmount Amount of MWG to receive (can be partial)
     */
    function fillSellOrder(uint256 orderId, uint256 mwgAmount)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        Order storage order = orders[orderId];
        
        require(order.orderId != 0, "Order does not exist");
        require(order.orderType == OrderType.SELL, "Not a sell order");
        require(
            order.status == OrderStatus.ACTIVE || order.status == OrderStatus.PARTIALLY_FILLED,
            "Order not active"
        );
        require(block.timestamp < order.expiresAt, "Order expired");
        require(msg.sender != order.user, "Cannot fill own order");
        require(mwgAmount > 0, "Amount must be greater than 0");
        require(mwgAmount <= order.remaining, "Amount exceeds remaining");

        // Calculate required BNB
        uint256 bnbAmount = (mwgAmount * order.price) / 1e18;
        require(bnbAmount > 0, "Fill amount rounds to zero");
        require(msg.value == bnbAmount, "Incorrect BNB amount");

        // Calculate fee using fee at order creation (prevents retroactive changes)
        uint256 fee = (mwgAmount * order.feeAtCreation) / 10000;
        uint256 mwgToFiller = mwgAmount - fee;

        // EFFECTS: Update order state
        order.filled += mwgAmount;
        order.remaining -= mwgAmount;

        // Update status
        if (order.remaining == 0) {
            order.status = OrderStatus.FILLED;
            _removeFromActiveOrders(orderId, OrderType.SELL);
        } else {
            order.status = OrderStatus.PARTIALLY_FILLED;
        }

        // Record fill
        uint256 fillId = ++_fillIdCounter;
        
        orderFills[orderId].push(Fill({
            fillId: fillId,
            orderId: orderId,
            filler: msg.sender,
            mwgAmount: mwgAmount,
            bnbAmount: bnbAmount,
            timestamp: block.timestamp
        }));

        emit OrderFilled(orderId, fillId, msg.sender, mwgAmount, bnbAmount, order.status);

        // INTERACTIONS: External calls last
        // Transfer MWG from contract to filler (minus fee)
        require(
            mwgToken.transfer(msg.sender, mwgToFiller),
            "MWG transfer failed"
        );

        // Burn MWG fee by sending to dead address (ERC20 prevents transfer to address(0))
        if (fee > 0) {
            require(
                mwgToken.transfer(DEAD_ADDRESS, fee),
                "MWG fee burn failed"
            );
        }

        // Use pull-over-push pattern to prevent locked BNB
        pendingWithdrawals[order.user] += bnbAmount;

        // No BNB fee on sell orders - fee is taken in MWG and burned
    }

    // =============================================================================
    // Order Management Functions
    // =============================================================================

    /**
     * @notice Cancel an order and return funds
     * @param orderId The ID of the order to cancel
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.orderId != 0, "Order does not exist");
        require(order.user == msg.sender, "Not order owner");
        require(
            order.status == OrderStatus.ACTIVE || order.status == OrderStatus.PARTIALLY_FILLED,
            "Order not active"
        );

        uint256 bnbRefund = 0;
        uint256 mwgRefund = 0;

        // Calculate refund amounts
        if (order.orderType == OrderType.BUY) {
            bnbRefund = (order.remaining * order.price) / 1e18;
        } else {
            mwgRefund = order.remaining;
        }

        // EFFECTS: Update state
        order.status = OrderStatus.CANCELLED;
        order.remaining = 0;

        if (order.orderType == OrderType.BUY) {
            _removeFromActiveOrders(orderId, OrderType.BUY);
        } else {
            _removeFromActiveOrders(orderId, OrderType.SELL);
        }

        emit OrderCancelled(orderId, msg.sender, bnbRefund, mwgRefund);
        if (order.orderType == OrderType.BUY) {
            // Use pull-over-push pattern for BNB refund
            pendingWithdrawals[msg.sender] += bnbRefund;
        } else {
            // Return remaining MWG to user
            require(
                mwgToken.transfer(msg.sender, mwgRefund),
                "MWG refund failed"
            );
        }
    }

    /**
     * @notice Mark expired orders (can be called by order owner or anyone after expiration + 1 hour)
     * @dev Prevents grief attacks by front-running cancel transactions
     * @param orderIds Array of order IDs to check for expiration
     */
    function markExpiredOrders(uint256[] calldata orderIds) external {
        for (uint256 i = 0; i < orderIds.length; i++) {
            uint256 orderId = orderIds[i];
            Order storage order = orders[orderId];

            if (
                order.orderId != 0 &&
                (order.status == OrderStatus.ACTIVE || order.status == OrderStatus.PARTIALLY_FILLED) &&
                block.timestamp >= order.expiresAt
            ) {
                // Only order owner can mark immediately, others must wait 1 hour after expiry
                require(
                    msg.sender == order.user || block.timestamp >= order.expiresAt + 1 hours,
                    "Wait 1 hour after expiry or be order owner"
                );

                order.status = OrderStatus.EXPIRED;
                
                if (order.orderType == OrderType.BUY) {
                    _removeFromActiveOrders(orderId, OrderType.BUY);
                } else {
                    _removeFromActiveOrders(orderId, OrderType.SELL);
                }

                emit OrderExpired(orderId);
            }
        }
    }

    /**
     * @notice Claim funds from expired order
     * @param orderId The ID of the expired order
     */
    function claimExpiredOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.orderId != 0, "Order does not exist");
        require(order.user == msg.sender, "Not order owner");
        require(order.status == OrderStatus.EXPIRED, "Order not expired");
        require(order.remaining > 0, "No funds to claim");

        uint256 bnbRefund = 0;
        uint256 mwgRefund = 0;

        // Calculate refund amounts
        if (order.orderType == OrderType.BUY) {
            bnbRefund = (order.remaining * order.price) / 1e18;
        } else {
            mwgRefund = order.remaining;
        }

        // EFFECTS: Update state
        order.remaining = 0;

        emit OrderCancelled(orderId, msg.sender, bnbRefund, mwgRefund);

        // INTERACTIONS: External calls last
        if (order.orderType == OrderType.BUY) {
            // Use pull-over-push pattern for BNB refund
            pendingWithdrawals[msg.sender] += bnbRefund;
        } else {
            require(
                mwgToken.transfer(msg.sender, mwgRefund),
                "MWG refund failed"
            );
        }
    }

    // =============================================================================
    // View Functions
    // =============================================================================

    /**
     * @notice Get active orders with pagination to prevent DOS
     * @param offset Starting index
     * @param limit Maximum number of orders to return (max 100)
     * @return buyOrders Array of active BUY orders
     * @return sellOrders Array of active SELL orders
     * @return totalBuyOrders Total number of active buy orders
     * @return totalSellOrders Total number of active sell orders
     */
    function getActiveOrders(uint256 offset, uint256 limit)
        external
        view
        returns (
            Order[] memory buyOrders,
            Order[] memory sellOrders,
            uint256 totalBuyOrders,
            uint256 totalSellOrders
        )
    {
        require(limit <= 100, "Limit too high (max 100)");

        totalBuyOrders = activeBuyOrders.length;
        totalSellOrders = activeSellOrders.length;

        // Calculate actual sizes
        uint256 buySize = offset >= totalBuyOrders ? 0 : 
            (offset + limit > totalBuyOrders ? totalBuyOrders - offset : limit);
        uint256 sellSize = offset >= totalSellOrders ? 0 : 
            (offset + limit > totalSellOrders ? totalSellOrders - offset : limit);

        buyOrders = new Order[](buySize);
        for (uint256 i = 0; i < buySize; i++) {
            buyOrders[i] = orders[activeBuyOrders[offset + i]];
        }

        sellOrders = new Order[](sellSize);
        for (uint256 i = 0; i < sellSize; i++) {
            sellOrders[i] = orders[activeSellOrders[offset + i]];
        }

        return (buyOrders, sellOrders, totalBuyOrders, totalSellOrders);
    }

    /**
     * @notice Get user's orders
     * @param user Address of the user
     * @return userOrdersList Array of user's orders
     */
    function getUserOrders(address user) external view returns (Order[] memory userOrdersList) {
        uint256[] memory orderIds = userOrders[user];
        userOrdersList = new Order[](orderIds.length);
        uint256 i;
        for (i; i < orderIds.length; i++) {
            userOrdersList[i] = orders[orderIds[i]];
        }
        
        return userOrdersList;
    }

    /**
     * @notice Get fill history for an order
     * @param orderId The ID of the order
     * @return fills Array of fills for the order
     */
    function getOrderFills(uint256 orderId) external view returns (Fill[] memory fills) {
        return orderFills[orderId];
    }

    /**
     * @notice Get best BUY price (highest price willing to pay)
     * @return bestPrice The best buy price (0 if no orders)
     */
    function getBestBuyPrice() external view returns (uint256 bestPrice) {
        bestPrice = 0;
        uint256 i;
        for (i; i < activeBuyOrders.length; i++) {
            Order memory order = orders[activeBuyOrders[i]];
            if (order.price > bestPrice) {
                bestPrice = order.price;
            }
        }
        return bestPrice;
    }

    /**
     * @notice Get best SELL price (lowest price willing to accept)
     * @return bestPrice The best sell price (0 if no orders)
     */
    function getBestSellPrice() external view returns (uint256 bestPrice) {
        if (activeSellOrders.length == 0) return 0;
        
        bestPrice = type(uint256).max;
        uint256 i;
        for (i = 0; i < activeSellOrders.length; i++) {
            Order memory order = orders[activeSellOrders[i]];
            if (order.price < bestPrice) {
                bestPrice = order.price;
            }
        }
        
        if (bestPrice == type(uint256).max) {
            bestPrice = 0;
        }
        
        return bestPrice;
    }

    /**
     * @notice Get order book statistics
     * @return totalOrders Total number of orders created
     * @return activeBuyCount Number of active buy orders
     * @return activeSellCount Number of active sell orders
     */
    function getOrderBookStats()
        external
        view
        returns (
            uint256 totalOrders,
            uint256 activeBuyCount,
            uint256 activeSellCount
        )
    {
        totalOrders = _orderIdCounter;
        activeBuyCount = activeBuyOrders.length;
        activeSellCount = activeSellOrders.length;
        
        return (totalOrders, activeBuyCount, activeSellCount);
    }

    // =============================================================================
    // Admin Functions
    // =============================================================================

    /**
     * @notice Update minimum order amounts
     * @param _minMWG New minimum MWG amount
     * @param _minBNB New minimum BNB amount
     */
    function setMinimumAmounts(uint256 _minMWG, uint256 _minBNB)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(_minMWG > 0, "Invalid min MWG");
        require(_minBNB > 0, "Invalid min BNB");
        
        minMWGAmount = _minMWG;
        minBNBAmount = _minBNB;
        
        emit MinimumAmountsUpdated(_minMWG, _minBNB);
    }

    /**
     * @notice Update fee percentage and recipient
     * @param _feePercentage New fee percentage in basis points (e.g., 100 = 1%)
     * @param _feeRecipient New fee recipient address
     */
    function setFee(uint256 _feePercentage, address _feeRecipient)
        external
        onlyRole(ADMIN_ROLE)
    {
        require(_feePercentage <= 1000, "Fee too high (max 10%)");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        feePercentage = _feePercentage;
        feeRecipient = _feeRecipient;
        
        emit FeeUpdated(_feePercentage, _feeRecipient);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(PAUSE_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(PAUSE_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency cancel order by admin (in case of issues)
     * @param orderId The ID of the order to cancel
     */
    function emergencyCancelOrder(uint256 orderId)
        external
        nonReentrant
        onlyRole(ADMIN_ROLE)
    {
        Order storage order = orders[orderId];
        
        require(order.orderId != 0, "Order does not exist");
        require(
            order.status == OrderStatus.ACTIVE || order.status == OrderStatus.PARTIALLY_FILLED,
            "Order not active"
        );

        uint256 bnbRefund = 0;
        uint256 mwgRefund = 0;
        address orderUser = order.user;

        // Calculate refund amounts
        if (order.orderType == OrderType.BUY) {
            bnbRefund = (order.remaining * order.price) / 1e18;
        } else {
            mwgRefund = order.remaining;
        }

        // EFFECTS: Update state
        order.status = OrderStatus.CANCELLED;
        order.remaining = 0;

        if (order.orderType == OrderType.BUY) {
            _removeFromActiveOrders(orderId, OrderType.BUY);
        } else {
            _removeFromActiveOrders(orderId, OrderType.SELL);
        }

        emit OrderCancelled(orderId, orderUser, bnbRefund, mwgRefund);

        // INTERACTIONS: External calls last
        if (order.orderType == OrderType.BUY) {
            // Use pull-over-push pattern for BNB refund
            pendingWithdrawals[orderUser] += bnbRefund;
        } else {
            require(
                mwgToken.transfer(orderUser, mwgRefund),
                "MWG refund failed"
            );
        }
    }

    // =============================================================================
    // Internal Functions
    // =============================================================================

    /**
     * @notice Remove order from active orders array
     * @param orderId The ID of the order to remove
     * @param orderType The type of the order
     */
    function _removeFromActiveOrders(uint256 orderId, OrderType orderType) internal {
        uint256[] storage activeOrders = orderType == OrderType.BUY
            ? activeBuyOrders
            : activeSellOrders;
        uint256 i;
        for (i; i < activeOrders.length; i++) {
            if (activeOrders[i] == orderId) {
                // Move last element to this position and pop
                activeOrders[i] = activeOrders[activeOrders.length - 1];
                activeOrders.pop();
                break;
            }
        }
    }

    // =============================================================================
    // Withdrawal Functions (Pull-over-Push Pattern)
    // =============================================================================

    /**
     * @notice Withdraw pending BNB (pull-over-push pattern)
     * @dev Prevents locked BNB from failed transfers
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawals");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "BNB withdrawal failed");

        emit WithdrawalClaimed(msg.sender, amount);
    }

    /**
     * @notice Check pending withdrawal amount
     * @param user Address to check
     * @return amount Pending BNB amount
     */
    function getPendingWithdrawal(address user) external view returns (uint256) {
        return pendingWithdrawals[user];
    }

    // =============================================================================
    // Receive Function
    // =============================================================================

    /**
     * @notice Reject direct BNB transfers
     */
    receive() external payable {
        revert("Direct transfers not allowed");
    }
}
