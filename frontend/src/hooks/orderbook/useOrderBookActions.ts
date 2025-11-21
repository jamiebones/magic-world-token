import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGOrderBookABI from "@/abis/MWGOrderBook.json";
import MWGTokenABI from "@/abis/MagicWorldToken.json";
import type { CreateOrderParams, FillOrderParams } from "@/types/orderbook";

/**
 * Create a buy order (deposit BNB, want MWG)
 */
export function useCreateBuyOrder() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const createBuyOrder = (params: CreateOrderParams) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "createBuyOrder",
            args: [params.mwgAmount, params.pricePerMWG, params.expirySeconds],
            value: params.bnbValue,
        });
    };

    return {
        createBuyOrder,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Create a sell order (deposit MWG, want BNB)
 */
export function useCreateSellOrder() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const createSellOrder = (params: CreateOrderParams) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "createSellOrder",
            args: [params.mwgAmount, params.pricePerMWG, params.expirySeconds],
        });
    };

    return {
        createSellOrder,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Fill a buy order (send MWG, receive BNB)
 */
export function useFillBuyOrder() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const fillBuyOrder = (params: FillOrderParams) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "fillBuyOrder",
            args: [params.orderId, params.mwgAmount],
        });
    };

    return {
        fillBuyOrder,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Fill a sell order (send BNB, receive MWG)
 */
export function useFillSellOrder() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const fillSellOrder = (params: FillOrderParams) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "fillSellOrder",
            args: [params.orderId, params.mwgAmount],
            value: params.bnbValue,
        });
    };

    return {
        fillSellOrder,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Cancel an order
 */
export function useCancelOrder() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const cancelOrder = (orderId: bigint) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "cancelOrder",
            args: [orderId],
        });
    };

    return {
        cancelOrder,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Withdraw pending BNB
 */
export function useWithdraw() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const withdraw = () => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "withdraw",
        });
    };

    return {
        withdraw,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Emergency cancel order (admin only)
 */
export function useEmergencyCancelOrder() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const emergencyCancelOrder = (orderId: bigint) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "emergencyCancelOrder",
            args: [orderId],
        });
    };

    return {
        emergencyCancelOrder,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Set fee (admin only)
 */
export function useSetFee() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const setFee = (feePercentage: bigint, feeRecipient: `0x${string}`) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "setFee",
            args: [feePercentage, feeRecipient],
        });
    };

    return {
        setFee,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Set minimum amounts (admin only)
 */
export function useSetMinimumAmounts() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const setMinimumAmounts = (minMWG: bigint, minBNB: bigint) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "setMinimumAmounts",
            args: [minMWG, minBNB],
        });
    };

    return {
        setMinimumAmounts,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Set paused status (pause role only)
 */
export function useSetPaused() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const setPaused = (paused: boolean) => {
        writeContract({
            address: CONTRACT_ADDRESSES.ORDER_BOOK,
            abi: MWGOrderBookABI.abi,
            functionName: "setPaused",
            args: [paused],
        });
    };

    return {
        setPaused,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}

/**
 * Get MWG token balance
 */
export function useMWGBalance(address?: `0x${string}`) {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.TOKEN,
        abi: MWGTokenABI.abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    return {
        balance: (data as bigint) || BigInt(0),
        isLoading,
        error,
        refetch,
    };
}

/**
 * Get MWG token allowance
 */
export function useMWGAllowance(owner?: `0x${string}`, spender?: `0x${string}`) {
    const { data, isLoading, error, refetch } = useReadContract({
        address: CONTRACT_ADDRESSES.TOKEN,
        abi: MWGTokenABI.abi,
        functionName: "allowance",
        args: owner && spender ? [owner, spender] : undefined,
        query: {
            enabled: !!owner && !!spender,
        },
    });

    return {
        allowance: (data as bigint) || BigInt(0),
        isLoading,
        error,
        refetch,
    };
}

/**
 * Approve MWG tokens
 */
export function useApproveMWG() {
    const { data: hash, writeContract, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const approve = ({ spender, amount }: { spender: `0x${string}`; amount: bigint }) => {
        writeContract({
            address: CONTRACT_ADDRESSES.TOKEN,
            abi: MWGTokenABI.abi,
            functionName: "approve",
            args: [spender, amount],
        });
    };

    return {
        approve,
        hash,
        isPending: isPending || isConfirming,
        isSuccess,
        error,
    };
}
