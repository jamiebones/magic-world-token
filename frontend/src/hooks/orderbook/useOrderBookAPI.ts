import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { querySubgraph } from '@/lib/subgraph';

// ─── Subgraph entity types ──────────────────────────────────────────

/** Raw order entity from the subgraph (all BigInt fields are strings) */
export interface SubgraphOrder {
    id: string;
    orderId: string;
    user: string;
    orderType: number;
    mwgAmount: string;
    bnbAmount: string;
    pricePerMWG: string;
    filled: string;
    remaining: string;
    status: number;
    feeAtCreation: string;
    txHash: string;
    blockNumber: string;
    createdAt: string;
    expiresAt: string;
}

export interface SubgraphFill {
    id: string;
    orderId: string;
    fillId: string;
    filler: string;
    mwgAmount: string;
    bnbAmount: string;
    newStatus: number;
    txHash: string;
    blockNumber: string;
    timestamp: string;
    order: {
        user: string;
        pricePerMWG: string;
        orderType: number;
    };
}

export interface SubgraphCancellation {
    id: string;
    orderId: string;
    user: string;
    bnbRefund: string;
    mwgRefund: string;
    txHash: string;
    blockNumber: string;
    timestamp: string;
}

export interface SubgraphWithdrawal {
    id: string;
    user: string;
    amount: string;
    txHash: string;
    blockNumber: string;
    timestamp: string;
}

// ─── Response shapes matching what pages expect ─────────────────────

/** Shape expected by pages that read orders */
export interface Order {
    orderId: string;
    user: string;
    orderType: number;
    mwgAmount: string;
    bnbAmount: string;
    pricePerMWG: string;
    filled: string;
    remaining: string;
    status: number;
    createdAt: string;
    expiresAt: string;
    txHash: string;
    feeAtCreation: string;
    [key: string]: unknown;
}

export interface OrdersData {
    orders: Order[];
    total: number;
}

export interface StatsData {
    stats: {
        orders: {
            total: number;
            active: number;
            filled: number;
            cancelled: number;
            expired: number;
            activeBuy: number;
            activeSell: number;
        };
        fills: {
            total: number;
            mwgVolume: string;
            bnbVolume: string;
        };
    };
}

export interface BestPricesData {
    bestBuy: { orderId: string; price: string; remaining: string } | null;
    bestSell: { orderId: string; price: string; remaining: string } | null;
}

export interface FillData {
    orderId: string;
    filler: string;
    mwgAmount: string;
    bnbAmount: string;
    timestamp: string;
    txHash: string;
    orderType?: number;
}

export interface FillsResponse {
    fills: FillData[];
}

export interface ActivityItem {
    type: string;
    orderId: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

export interface ActivityData {
    activities: ActivityItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Convert a subgraph order (BigInt strings, unix timestamps) into the shape pages expect */
function toOrder(o: SubgraphOrder): Order {
    return {
        orderId: o.orderId,
        user: o.user,
        orderType: o.orderType,
        mwgAmount: o.mwgAmount,
        bnbAmount: o.bnbAmount,
        pricePerMWG: o.pricePerMWG,
        filled: o.filled,
        remaining: o.remaining,
        status: o.status,
        feeAtCreation: o.feeAtCreation,
        txHash: o.txHash,
        // Pages expect ISO date strings for display formatting
        createdAt: new Date(Number(o.createdAt) * 1000).toISOString(),
        expiresAt: new Date(Number(o.expiresAt) * 1000).toISOString(),
    };
}

// ─── GraphQL fragments ──────────────────────────────────────────────

const ORDER_FIELDS = `
    id
    orderId
    user
    orderType
    mwgAmount
    bnbAmount
    pricePerMWG
    filled
    remaining
    status
    feeAtCreation
    txHash
    blockNumber
    createdAt
    expiresAt
`;

const FILL_FIELDS = `
    id
    orderId
    fillId
    filler
    mwgAmount
    bnbAmount
    newStatus
    txHash
    blockNumber
    timestamp
    order {
        user
        pricePerMWG
        orderType
    }
`;

// ─── Hooks ──────────────────────────────────────────────────────────

/**
 * Get order book statistics computed from subgraph data
 */
export function useOrderBookStatsAPI() {
    return useQuery<StatsData>({
        queryKey: ['orderbook', 'stats'],
        queryFn: async () => {
            // Fetch counts by status in parallel
            const data = await querySubgraph<{
                active: SubgraphOrder[];
                filled: SubgraphOrder[];
                cancelled: SubgraphOrder[];
                expired: SubgraphOrder[];
                activeBuy: SubgraphOrder[];
                activeSell: SubgraphOrder[];
                allOrders: SubgraphOrder[];
                fills: SubgraphFill[];
            }>(`{
                active: orders(where: { status: 0 }, first: 1000) { id }
                filled: orders(where: { status: 1 }, first: 1000) { id }
                cancelled: orders(where: { status: 3 }, first: 1000) { id }
                expired: orders(where: { status: 4 }, first: 1000) { id }
                activeBuy: orders(where: { status: 0, orderType: 0 }, first: 1000) { id }
                activeSell: orders(where: { status: 0, orderType: 1 }, first: 1000) { id }
                allOrders: orders(first: 1000) { id }
                fills: orderFills(first: 1000) { id mwgAmount bnbAmount }
            }`);

            let totalMwgVolume = BigInt(0);
            let totalBnbVolume = BigInt(0);
            for (const f of data.fills) {
                totalMwgVolume += BigInt(f.mwgAmount);
                totalBnbVolume += BigInt(f.bnbAmount);
            }

            return {
                stats: {
                    orders: {
                        total: data.allOrders.length,
                        active: data.active.length,
                        filled: data.filled.length,
                        cancelled: data.cancelled.length,
                        expired: data.expired.length,
                        activeBuy: data.activeBuy.length,
                        activeSell: data.activeSell.length,
                    },
                    fills: {
                        total: data.fills.length,
                        mwgVolume: totalMwgVolume.toString(),
                        bnbVolume: totalBnbVolume.toString(),
                    },
                },
            };
        },
        refetchInterval: 10000,
    });
}

/**
 * Get active orders from the subgraph, optionally filtered by order type
 */
export function useActiveOrdersAPI(orderType?: 0 | 1, limit = 50, offset = 0) {
    return useQuery<OrdersData>({
        queryKey: ['orderbook', 'orders', orderType, limit, offset],
        queryFn: async () => {
            const typeFilter = orderType !== undefined ? `, orderType: ${orderType}` : '';
            const data = await querySubgraph<{ orders: SubgraphOrder[] }>(`{
                orders(
                    where: { status: 0${typeFilter} },
                    orderBy: createdAt,
                    orderDirection: desc,
                    first: ${limit},
                    skip: ${offset}
                ) {
                    ${ORDER_FIELDS}
                }
            }`);

            return {
                orders: data.orders.map(toOrder),
                total: data.orders.length,
            };
        },
        refetchInterval: 5000,
    });
}

/**
 * Get specific order details
 */
export function useOrderDetailsAPI(orderId?: number) {
    return useQuery({
        queryKey: ['orderbook', 'order', orderId],
        queryFn: async () => {
            const data = await querySubgraph<{ order: SubgraphOrder | null }>(`{
                order(id: "${orderId}") {
                    ${ORDER_FIELDS}
                }
            }`);
            return data.order ? toOrder(data.order) : null;
        },
        enabled: orderId !== undefined,
        refetchInterval: 5000,
    });
}

/**
 * Get user's orders from the subgraph
 */
export function useUserOrdersAPI(address?: string, status?: number, limit = 50, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = (address || connectedAddress)?.toLowerCase();

    return useQuery<OrdersData>({
        queryKey: ['orderbook', 'user-orders', userAddress, status, limit, offset],
        queryFn: async () => {
            const statusFilter = status !== undefined ? `, status: ${status}` : '';
            const data = await querySubgraph<{ orders: SubgraphOrder[] }>(`{
                orders(
                    where: { user: "${userAddress}"${statusFilter} },
                    orderBy: createdAt,
                    orderDirection: desc,
                    first: ${limit},
                    skip: ${offset}
                ) {
                    ${ORDER_FIELDS}
                }
            }`);

            return {
                orders: data.orders.map(toOrder),
                total: data.orders.length,
            };
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}

/**
 * Get all order fills
 */
export function useOrderFillsAPI(limit = 20, offset = 0) {
    return useQuery<FillsResponse>({
        queryKey: ['orderbook', 'fills', limit, offset],
        queryFn: async () => {
            const data = await querySubgraph<{ orderFills: SubgraphFill[] }>(`{
                orderFills(
                    orderBy: timestamp,
                    orderDirection: desc,
                    first: ${limit},
                    skip: ${offset}
                ) {
                    ${FILL_FIELDS}
                }
            }`);

            return {
                fills: data.orderFills.map(f => ({
                    orderId: f.orderId,
                    filler: f.filler,
                    mwgAmount: f.mwgAmount,
                    bnbAmount: f.bnbAmount,
                    timestamp: new Date(Number(f.timestamp) * 1000).toISOString(),
                    txHash: f.txHash,
                    orderType: f.order?.orderType,
                })),
            };
        },
        refetchInterval: 5000,
    });
}

/**
 * Get fills for a specific order
 */
export function useOrderFillsByOrderIdAPI(orderId?: number) {
    return useQuery<FillsResponse>({
        queryKey: ['orderbook', 'fills', 'order', orderId],
        queryFn: async () => {
            const data = await querySubgraph<{ orderFills: SubgraphFill[] }>(`{
                orderFills(
                    where: { orderId: "${orderId}" },
                    orderBy: timestamp,
                    orderDirection: desc
                ) {
                    ${FILL_FIELDS}
                }
            }`);

            return {
                fills: data.orderFills.map(f => ({
                    orderId: f.orderId,
                    filler: f.filler,
                    mwgAmount: f.mwgAmount,
                    bnbAmount: f.bnbAmount,
                    timestamp: new Date(Number(f.timestamp) * 1000).toISOString(),
                    txHash: f.txHash,
                    orderType: f.order?.orderType,
                })),
            };
        },
        enabled: orderId !== undefined,
        refetchInterval: 5000,
    });
}

/**
 * Get recent activity (orders + fills + cancellations combined)
 */
export function useRecentActivityAPI(limit = 10) {
    return useQuery<ActivityData>({
        queryKey: ['orderbook', 'recent-activity', limit],
        queryFn: async () => {
            // Fetch recent orders, fills, and cancellations in a single query
            const data = await querySubgraph<{
                orders: SubgraphOrder[];
                orderFills: SubgraphFill[];
                orderCancellations: SubgraphCancellation[];
            }>(`{
                orders(orderBy: createdAt, orderDirection: desc, first: ${limit}) {
                    orderId
                    user
                    orderType
                    mwgAmount
                    createdAt
                }
                orderFills(orderBy: timestamp, orderDirection: desc, first: ${limit}) {
                    orderId
                    filler
                    mwgAmount
                    timestamp
                }
                orderCancellations(orderBy: timestamp, orderDirection: desc, first: ${limit}) {
                    orderId
                    user
                    timestamp
                }
            }`);

            const activities: ActivityItem[] = [
                ...data.orders.map(o => ({
                    type: 'created' as const,
                    orderId: o.orderId,
                    timestamp: new Date(Number(o.createdAt) * 1000).toISOString(),
                    data: { user: o.user, orderType: o.orderType, mwgAmount: o.mwgAmount },
                })),
                ...data.orderFills.map(f => ({
                    type: 'filled' as const,
                    orderId: f.orderId,
                    timestamp: new Date(Number(f.timestamp) * 1000).toISOString(),
                    data: { filler: f.filler, mwgAmount: f.mwgAmount },
                })),
                ...data.orderCancellations.map(c => ({
                    type: 'cancelled' as const,
                    orderId: c.orderId,
                    timestamp: new Date(Number(c.timestamp) * 1000).toISOString(),
                    data: { user: c.user },
                })),
            ];

            // Sort by timestamp descending and take top N
            activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return { activities: activities.slice(0, limit) };
        },
        refetchInterval: 3000,
    });
}

/**
 * Get best buy and sell prices from active orders
 */
export function useBestPricesAPI() {
    return useQuery<BestPricesData>({
        queryKey: ['orderbook', 'best-prices'],
        queryFn: async () => {
            const data = await querySubgraph<{
                bestBuy: SubgraphOrder[];
                bestSell: SubgraphOrder[];
            }>(`{
                bestBuy: orders(
                    where: { status: 0, orderType: 0 },
                    orderBy: pricePerMWG,
                    orderDirection: desc,
                    first: 1
                ) {
                    orderId
                    pricePerMWG
                    remaining
                }
                bestSell: orders(
                    where: { status: 0, orderType: 1 },
                    orderBy: pricePerMWG,
                    orderDirection: asc,
                    first: 1
                ) {
                    orderId
                    pricePerMWG
                    remaining
                }
            }`);

            return {
                bestBuy: data.bestBuy.length > 0
                    ? { orderId: data.bestBuy[0].orderId, price: data.bestBuy[0].pricePerMWG, remaining: data.bestBuy[0].remaining }
                    : null,
                bestSell: data.bestSell.length > 0
                    ? { orderId: data.bestSell[0].orderId, price: data.bestSell[0].pricePerMWG, remaining: data.bestSell[0].remaining }
                    : null,
            };
        },
        refetchInterval: 5000,
    });
}

/**
 * Get fills where user was the filler
 */
export function useUserFillsAsFillerAPI(address?: string, limit = 20, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = (address || connectedAddress)?.toLowerCase();

    return useQuery<FillsResponse>({
        queryKey: ['orderbook', 'user-fills-filler', userAddress, limit, offset],
        queryFn: async () => {
            const data = await querySubgraph<{ orderFills: SubgraphFill[] }>(`{
                orderFills(
                    where: { filler: "${userAddress}" },
                    orderBy: timestamp,
                    orderDirection: desc,
                    first: ${limit},
                    skip: ${offset}
                ) {
                    ${FILL_FIELDS}
                }
            }`);

            return {
                fills: data.orderFills.map(f => ({
                    orderId: f.orderId,
                    filler: f.filler,
                    mwgAmount: f.mwgAmount,
                    bnbAmount: f.bnbAmount,
                    timestamp: new Date(Number(f.timestamp) * 1000).toISOString(),
                    txHash: f.txHash,
                    orderType: f.order?.orderType,
                })),
            };
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}

/**
 * Get fills on orders the user created (i.e. the user's orders that got filled by someone)
 */
export function useUserFillsAsCreatorAPI(address?: string, limit = 20, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = (address || connectedAddress)?.toLowerCase();

    return useQuery<FillsResponse>({
        queryKey: ['orderbook', 'user-fills-creator', userAddress, limit, offset],
        queryFn: async () => {
            const data = await querySubgraph<{ orderFills: SubgraphFill[] }>(`{
                orderFills(
                    where: { order_: { user: "${userAddress}" } },
                    orderBy: timestamp,
                    orderDirection: desc,
                    first: ${limit},
                    skip: ${offset}
                ) {
                    ${FILL_FIELDS}
                }
            }`);

            return {
                fills: data.orderFills.map(f => ({
                    orderId: f.orderId,
                    filler: f.filler,
                    mwgAmount: f.mwgAmount,
                    bnbAmount: f.bnbAmount,
                    timestamp: new Date(Number(f.timestamp) * 1000).toISOString(),
                    txHash: f.txHash,
                    orderType: f.order?.orderType,
                })),
            };
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}

/**
 * Get user's withdrawals
 */
export function useUserWithdrawalsAPI(address?: string, limit = 20, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = (address || connectedAddress)?.toLowerCase();

    return useQuery({
        queryKey: ['orderbook', 'user-withdrawals', userAddress, limit, offset],
        queryFn: async () => {
            const data = await querySubgraph<{ withdrawals: SubgraphWithdrawal[] }>(`{
                withdrawals(
                    where: { user: "${userAddress}" },
                    orderBy: timestamp,
                    orderDirection: desc,
                    first: ${limit},
                    skip: ${offset}
                ) {
                    id
                    user
                    amount
                    txHash
                    blockNumber
                    timestamp
                }
            }`);

            return {
                withdrawals: data.withdrawals.map(w => ({
                    ...w,
                    timestamp: new Date(Number(w.timestamp) * 1000).toISOString(),
                })),
            };
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}

