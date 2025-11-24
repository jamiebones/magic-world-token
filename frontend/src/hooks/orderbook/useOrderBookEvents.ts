import { useWatchContractEvent } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGOrderBookABI from "@/abis/MWGOrderBook.json";
import { useState, useEffect } from "react";

export interface OrderCreatedEvent {
    orderId: bigint;
    user: `0x${string}`;
    orderType: number;
    mwgAmount: bigint;
    bnbAmount: bigint;
    pricePerMWG: bigint;
    expiresAt: bigint;
}

export interface OrderFilledEvent {
    orderId: bigint;
    filler: `0x${string}`;
    mwgAmount: bigint;
    bnbAmount: bigint;
    timestamp?: number;
    transactionHash?: string;
    orderType?: number;
}

export interface OrderCancelledEvent {
    orderId: bigint;
    user: `0x${string}`;
}

export interface WithdrawalClaimedEvent {
    user: `0x${string}`;
    amount: bigint;
}

/**
 * Watch for OrderCreated events
 */
export function useOrderCreatedEvents(enabled: boolean = true) {
    const [events, setEvents] = useState<OrderCreatedEvent[]>([]);

    useWatchContractEvent({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        eventName: "OrderCreated",
        enabled,
        onLogs(logs) {
            const newEvents = logs.map((log) => {
                const args = (log as unknown as { args: Record<string, unknown> }).args;
                return {
                    orderId: args.orderId as bigint,
                    user: args.user as `0x${string}`,
                    orderType: args.orderType as number,
                    mwgAmount: args.mwgAmount as bigint,
                    bnbAmount: args.bnbAmount as bigint,
                    pricePerMWG: args.pricePerMWG as bigint,
                    expiresAt: args.expiresAt as bigint,
                };
            });
            setEvents((prev) => [...newEvents, ...prev]);
        },
    });

    return events;
}

/**
 * Watch for OrderFilled events
 */
export function useOrderFilledEvents(enabled: boolean = true) {
    const [events, setEvents] = useState<OrderFilledEvent[]>([]);

    useWatchContractEvent({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        eventName: "OrderFilled",
        enabled,
        onLogs(logs) {
            const newEvents = logs.map((log) => {
                const eventLog = log as unknown as { args: Record<string, unknown>; blockNumber?: bigint; transactionHash?: string };
                const args = eventLog.args;
                return {
                    orderId: args.orderId as bigint,
                    filler: args.filler as `0x${string}`,
                    mwgAmount: args.mwgAmount as bigint,
                    bnbAmount: args.bnbAmount as bigint,
                    timestamp: eventLog.blockNumber ? Math.floor(Date.now() / 1000) : undefined,
                    transactionHash: eventLog.transactionHash || undefined,
                    orderType: 0, // Will be fetched from order details if needed
                } as OrderFilledEvent;
            });
            setEvents((prev) => [...newEvents, ...prev]);
        },
    });

    return events;
}

/**
 * Watch for OrderCancelled events
 */
export function useOrderCancelledEvents(enabled: boolean = true) {
    const [events, setEvents] = useState<OrderCancelledEvent[]>([]);

    useWatchContractEvent({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        eventName: "OrderCancelled",
        enabled,
        onLogs(logs) {
            const newEvents = logs.map((log) => {
                const args = (log as unknown as { args: Record<string, unknown> }).args;
                return {
                    orderId: args.orderId as bigint,
                    user: args.user as `0x${string}`,
                };
            });
            setEvents((prev) => [...newEvents, ...prev]);
        },
    });

    return events;
}

/**
 * Watch for WithdrawalClaimed events
 */
export function useWithdrawalClaimedEvents(enabled: boolean = true) {
    const [events, setEvents] = useState<WithdrawalClaimedEvent[]>([]);

    useWatchContractEvent({
        address: CONTRACT_ADDRESSES.ORDER_BOOK,
        abi: MWGOrderBookABI.abi,
        eventName: "WithdrawalClaimed",
        enabled,
        onLogs(logs) {
            const newEvents = logs.map((log) => {
                const args = (log as unknown as { args: Record<string, unknown> }).args;
                return {
                    user: args.user as `0x${string}`,
                    amount: args.amount as bigint,
                };
            });
            setEvents((prev) => [...newEvents, ...prev]);
        },
    });

    return events;
}

/**
 * Get recent activity feed (all events combined)
 */
export function useRecentActivity(limit: number = 10) {
    const orderCreated = useOrderCreatedEvents();
    const orderFilled = useOrderFilledEvents();
    const orderCancelled = useOrderCancelledEvents();
    const withdrawalClaimed = useWithdrawalClaimedEvents();

    const [activity, setActivity] = useState<
        Array<{
            type: "created" | "filled" | "cancelled" | "withdrawn";
            timestamp: number;
            data: OrderCreatedEvent | OrderFilledEvent | OrderCancelledEvent | WithdrawalClaimedEvent;
        }>
    >([]);

    useEffect(() => {
        const allEvents = [
            ...orderCreated.map((e) => ({ type: "created" as const, data: e, timestamp: Date.now() })),
            ...orderFilled.map((e) => ({ type: "filled" as const, data: e, timestamp: Date.now() })),
            ...orderCancelled.map((e) => ({ type: "cancelled" as const, data: e, timestamp: Date.now() })),
            ...withdrawalClaimed.map((e) => ({ type: "withdrawn" as const, data: e, timestamp: Date.now() })),
        ];

        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        setActivity(allEvents.slice(0, limit));
    }, [orderCreated, orderFilled, orderCancelled, withdrawalClaimed, limit]);

    return activity;
}

/**
 * Watch for events filtered by user address
 */
export function useUserActivity(userAddress?: `0x${string}`, limit: number = 10) {
    const orderCreated = useOrderCreatedEvents();
    const orderFilled = useOrderFilledEvents();
    const orderCancelled = useOrderCancelledEvents();
    const withdrawalClaimed = useWithdrawalClaimedEvents();

    const [userActivity, setUserActivity] = useState<
        Array<{
            type: "created" | "filled" | "cancelled" | "withdrawn";
            timestamp: number;
            data: OrderCreatedEvent | OrderFilledEvent | OrderCancelledEvent | WithdrawalClaimedEvent;
        }>
    >([]);

    useEffect(() => {
        if (!userAddress) {
            setUserActivity([]);
            return;
        }

        const allEvents = [
            ...orderCreated
                .filter((e) => e.user.toLowerCase() === userAddress.toLowerCase())
                .map((e) => ({ type: "created" as const, data: e, timestamp: Date.now() })),
            ...orderFilled
                .filter((e) => e.filler.toLowerCase() === userAddress.toLowerCase())
                .map((e) => ({ type: "filled" as const, data: e, timestamp: Date.now() })),
            ...orderCancelled
                .filter((e) => e.user.toLowerCase() === userAddress.toLowerCase())
                .map((e) => ({ type: "cancelled" as const, data: e, timestamp: Date.now() })),
            ...withdrawalClaimed
                .filter((e) => e.user.toLowerCase() === userAddress.toLowerCase())
                .map((e) => ({ type: "withdrawn" as const, data: e, timestamp: Date.now() })),
        ];

        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        setUserActivity(allEvents.slice(0, limit));
    }, [orderCreated, orderFilled, orderCancelled, withdrawalClaimed, userAddress, limit]);

    return userActivity;
}
