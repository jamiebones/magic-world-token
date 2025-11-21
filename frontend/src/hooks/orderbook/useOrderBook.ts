import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGOrderBookABI from "@/abis/MWGOrderBook.json";
import { useMemo } from "react";
import type { Order, OrderBookStats } from "@/types/orderbook";

/**
 * Get comprehensive order book statistics
 */
export function useOrderBookStats() {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "getOrderBookStats",
    });

    const stats = useMemo(() => {
        if (!data) return null;
        const result = data as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
        return {
            totalOrders: result[0],
            totalBuyOrders: result[1],
            totalSellOrders: result[2],
            totalVolumeMWG: result[3],
            totalVolumeBNB: result[4],
            bestBuyPrice: result[5],
            bestSellPrice: result[6],
        } as OrderBookStats;
    }, [data]);

    return {
        stats,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get best buy price in order book
 */
export function useBestBuyPrice() {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "getBestBuyPrice",
    });

    const bestBuy = useMemo(() => {
        if (!data) return null;
        const result = data as readonly [bigint, bigint];
        return {
            price: result[0],
            orderId: result[1],
        };
    }, [data]);

    return {
        bestBuy,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get best sell price in order book
 */
export function useBestSellPrice() {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "getBestSellPrice",
    });

    const bestSell = useMemo(() => {
        if (!data) return null;
        const result = data as readonly [bigint, bigint];
        return {
            price: result[0],
            orderId: result[1],
        };
    }, [data]);

    return {
        bestSell,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get active orders with pagination
 */
export function useActiveOrders(offset: number = 0, limit: number = 100) {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "getActiveOrders",
        args: [BigInt(offset), BigInt(limit)],
    });

    // Debug logging
    console.log('=== useActiveOrders Hook Debug ===');
    console.log('Raw data from contract:', data);
    console.log('Type of data:', typeof data);
    console.log('Is array:', Array.isArray(data));
    console.log('isLoading:', isLoading);
    console.log('error:', error);

    // Contract returns tuple: [buyOrders[], sellOrders[], totalBuyCount, totalSellCount]
    const result = data as [any[], any[], bigint, bigint] | undefined;

    console.log('Parsed result:', result);
    console.log('buyOrders (result[0]):', result?.[0]);
    console.log('sellOrders (result[1]):', result?.[1]);
    console.log('totalBuyOrders (result[2]):', result?.[2]);
    console.log('totalSellOrders (result[3]):', result?.[3]);

    return {
        buyOrders: result?.[0] || [],
        sellOrders: result?.[1] || [],
        totalBuyOrders: result?.[2] || BigInt(0),
        totalSellOrders: result?.[3] || BigInt(0),
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get user's orders
 */
export function useUserOrders(userAddress?: `0x${string}`) {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "getUserOrders",
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: !!userAddress,
        },
    });

    return {
        orderIds: (data as bigint[]) || [],
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get specific order details
 */
export function useOrder(orderId?: bigint) {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "orders",
        args: orderId !== undefined ? [orderId] : undefined,
        query: {
            enabled: orderId !== undefined,
        },
    });

    const order = useMemo(() => {
        if (!data || orderId === undefined) return null;
        const result = data as readonly [
            `0x${string}`, // user
            number, // orderType
            bigint, // mwgAmount
            bigint, // bnbAmount
            bigint, // pricePerMWG
            bigint, // filled
            bigint, // remaining
            bigint, // createdAt
            bigint, // expiresAt
            number, // status
            bigint  // feeAtCreation
        ];

        return {
            orderId,
            user: result[0],
            orderType: result[1],
            mwgAmount: result[2],
            bnbAmount: result[3],
            pricePerMWG: result[4],
            filled: result[5],
            remaining: result[6],
            createdAt: result[7],
            expiresAt: result[8],
            status: result[9],
            feeAtCreation: result[10],
        } as Order;
    }, [data, orderId]);

    return {
        order,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get pending withdrawal for user
 */
export function usePendingWithdrawal(userAddress?: `0x${string}`) {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "pendingWithdrawals",
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: !!userAddress,
        },
    });

    return {
        amount: (data as bigint) || BigInt(0),
        hasWithdrawal: data ? (data as bigint) > BigInt(0) : false,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get contract paused status
 */
export function useOrderBookPaused() {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "paused",
    });

    return {
        isPaused: data as boolean,
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get minimum amounts
 */
export function useMinimumAmounts() {
    const { data: minMWG } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "minMWGAmount",
    });

    const { data: minBNB } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "minBNBAmount",
    });

    return {
        minMWGAmount: (minMWG as bigint) || BigInt(0),
        minBNBAmount: (minBNB as bigint) || BigInt(0),
    };
}

/**
 * Get fee percentage and recipient
 */
export function useFeeInfo() {
    const { data: feePercentage } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "feePercentage",
    });

    const { data: feeRecipient } = useReadContract({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        functionName: "feeRecipient",
    });

    return {
        feePercentage: (feePercentage as bigint) || BigInt(0),
        feeRecipient: (feeRecipient as `0x${string}`) || ("0x0000000000000000000000000000000000000000" as `0x${string}`),
    };
}
