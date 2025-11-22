import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// API Response Types
interface APIResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

interface OrdersData {
    orders: any[];
    total: number;
    limit: number;
    offset: number;
}

interface StatsData {
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
            mwgVolume: number;
            bnbVolume: number;
            avgPrice: number;
        };
        prices: {
            bestBuy: string | null;
            bestSell: string | null;
            spread: string | null;
        };
    };
}

interface BestPricesData {
    bestBuy: {
        orderId: string;
        price: string;
        remaining: string;
    } | null;
    bestSell: {
        orderId: string;
        price: string;
        remaining: string;
    } | null;
}

interface FillsData {
    fills: any[];
    total: number;
    limit: number;
    offset: number;
}

interface ActivityData {
    activities: any[];
}

/**
 * Fetch helper with error handling
 */
async function fetchAPI<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }
    const json = await response.json();
    if (!json.success) {
        throw new Error(json.error || 'API request failed');
    }
    return json.data as T;
}

/**
 * Get order book statistics from API
 */
export function useOrderBookStatsAPI() {
    return useQuery<StatsData>({
        queryKey: ['orderbook', 'stats'],
        queryFn: () => fetchAPI<StatsData>('/api/orderbook/stats'),
        refetchInterval: 10000, // Refetch every 10 seconds
    });
}

/**
 * Get active orders from API
 */
export function useActiveOrdersAPI(orderType?: 0 | 1, limit = 50, offset = 0) {
    return useQuery<OrdersData>({
        queryKey: ['orderbook', 'orders', orderType, limit, offset],
        queryFn: () => {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            if (orderType !== undefined) {
                params.append('orderType', orderType.toString());
            }
            return fetchAPI<OrdersData>(`/api/orderbook/orders?${params}`);
        },
        refetchInterval: 5000, // Refetch every 5 seconds
    });
}

/**
 * Get specific order details from API
 */
export function useOrderDetailsAPI(orderId?: number) {
    return useQuery({
        queryKey: ['orderbook', 'order', orderId],
        queryFn: () => fetchAPI(`/api/orderbook/orders/${orderId}`),
        enabled: !!orderId,
        refetchInterval: 5000,
    });
}

/**
 * Get user's orders from API
 */
export function useUserOrdersAPI(address?: string, status?: number, limit = 50, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = address || connectedAddress;

    return useQuery({
        queryKey: ['orderbook', 'user-orders', userAddress, status, limit, offset],
        queryFn: () => {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            if (status !== undefined) {
                params.append('status', status.toString());
            }
            return fetchAPI(`/api/orderbook/user/${userAddress}/orders?${params}`);
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}

/**
 * Get all order fills from API
 */
export function useOrderFillsAPI(limit = 20, offset = 0) {
    return useQuery({
        queryKey: ['orderbook', 'fills', limit, offset],
        queryFn: () => {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            return fetchAPI(`/api/orderbook/fills?${params}`);
        },
        refetchInterval: 5000,
    });
}

/**
 * Get fills for a specific order
 */
export function useOrderFillsByOrderIdAPI(orderId?: number) {
    return useQuery({
        queryKey: ['orderbook', 'fills', 'order', orderId],
        queryFn: () => fetchAPI(`/api/orderbook/fills/${orderId}`),
        enabled: !!orderId,
        refetchInterval: 5000,
    });
}

/**
 * Get recent activity (orders, fills, cancellations)
 */
export function useRecentActivityAPI(limit = 10) {
    return useQuery<ActivityData>({
        queryKey: ['orderbook', 'recent-activity', limit],
        queryFn: () => {
            const params = new URLSearchParams({ limit: limit.toString() });
            return fetchAPI<ActivityData>(`/api/orderbook/recent-activity?${params}`);
        },
        refetchInterval: 3000, // Refetch every 3 seconds for real-time feel
    });
}

/**
 * Get best buy and sell prices
 */
export function useBestPricesAPI() {
    return useQuery<BestPricesData>({
        queryKey: ['orderbook', 'best-prices'],
        queryFn: () => fetchAPI<BestPricesData>('/api/orderbook/best-prices'),
        refetchInterval: 5000,
    });
}

/**
 * Get user's fills as filler
 */
export function useUserFillsAsFillerAPI(address?: string, limit = 20, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = address || connectedAddress;

    return useQuery({
        queryKey: ['orderbook', 'user-fills-filler', userAddress, limit, offset],
        queryFn: () => {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            return fetchAPI(`/api/orderbook/user/${userAddress}/fills-as-filler?${params}`);
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}

/**
 * Get user's fills as creator
 */
export function useUserFillsAsCreatorAPI(address?: string, limit = 20, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = address || connectedAddress;

    return useQuery({
        queryKey: ['orderbook', 'user-fills-creator', userAddress, limit, offset],
        queryFn: () => {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            return fetchAPI(`/api/orderbook/user/${userAddress}/fills-as-creator?${params}`);
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}

/**
 * Get user's withdrawals
 */
export function useUserWithdrawalsAPI(address?: string, amountType?: 0 | 1, limit = 20, offset = 0) {
    const { address: connectedAddress } = useAccount();
    const userAddress = address || connectedAddress;

    return useQuery({
        queryKey: ['orderbook', 'user-withdrawals', userAddress, amountType, limit, offset],
        queryFn: () => {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            if (amountType !== undefined) {
                params.append('amountType', amountType.toString());
            }
            return fetchAPI(`/api/orderbook/user/${userAddress}/withdrawals?${params}`);
        },
        enabled: !!userAddress,
        refetchInterval: 5000,
    });
}
