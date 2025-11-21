// Order Book Types

export enum OrderType {
    BUY = 0,
    SELL = 1,
}

export enum OrderStatus {
    ACTIVE = 0,
    FILLED = 1,
    CANCELLED = 2,
    EXPIRED = 3,
}

export interface Order {
    orderId: bigint;
    user: `0x${string}`;
    orderType: OrderType;
    mwgAmount: bigint;
    bnbAmount: bigint;
    pricePerMWG: bigint;
    filled: bigint;
    remaining: bigint;
    createdAt: bigint;
    expiresAt: bigint;
    status: OrderStatus;
    feeAtCreation: bigint;
}

export interface OrderBookStats {
    totalOrders: bigint;
    totalBuyOrders: bigint;
    totalSellOrders: bigint;
    totalVolumeMWG: bigint;
    totalVolumeBNB: bigint;
    bestBuyPrice: bigint;
    bestSellPrice: bigint;
}

export interface CreateOrderParams {
    mwgAmount: bigint;
    pricePerMWG: bigint;
    expirySeconds: bigint;
    bnbValue?: bigint; // For buy orders
}

export interface FillOrderParams {
    orderId: bigint;
    mwgAmount: bigint;
    bnbValue?: bigint; // For sell orders
}

export interface PendingWithdrawal {
    amount: bigint;
    hasWithdrawal: boolean;
}

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
    [OrderType.BUY]: "Buy",
    [OrderType.SELL]: "Sell",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    [OrderStatus.ACTIVE]: "Active",
    [OrderStatus.FILLED]: "Filled",
    [OrderStatus.CANCELLED]: "Cancelled",
    [OrderStatus.EXPIRED]: "Expired",
};
