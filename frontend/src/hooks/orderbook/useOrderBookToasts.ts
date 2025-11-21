import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

/**
 * Helper hook to show toast notifications for order book transactions
 */
export function useOrderBookTransactionToast(
    isPending: boolean,
    isSuccess: boolean,
    error: Error | null,
    actionName: string,
    successMessage?: string
) {
    const hasShownPending = useRef(false);
    const hasShownSuccess = useRef(false);
    const hasShownError = useRef(false);

    useEffect(() => {
        if (isPending && !hasShownPending.current) {
            toast.loading(`${actionName}...`, { id: actionName });
            hasShownPending.current = true;
        }

        if (!isPending && hasShownPending.current) {
            // Reset when transaction completes
            hasShownPending.current = false;
        }
    }, [isPending, actionName]);

    useEffect(() => {
        if (isSuccess && !hasShownSuccess.current) {
            toast.success(successMessage || `✅ ${actionName} successful!`, {
                id: actionName,
                duration: 5000
            });
            hasShownSuccess.current = true;
        }

        // Reset success flag when starting new transaction
        if (!isSuccess && !isPending) {
            hasShownSuccess.current = false;
        }
    }, [isSuccess, isPending, actionName, successMessage]);

    useEffect(() => {
        if (error && !hasShownError.current) {
            toast.error(`❌ ${actionName} failed: ${error.message}`, {
                id: actionName,
                duration: 7000
            });
            hasShownError.current = true;
        }

        // Reset error flag
        if (!error) {
            hasShownError.current = false;
        }
    }, [error, actionName]);
}

/**
 * Show order creation toast
 */
export function showOrderCreationToast(orderType: "buy" | "sell") {
    return toast.loading(`Creating ${orderType} order...`, { id: `create-${orderType}` });
}

/**
 * Show order fill toast
 */
export function showOrderFillToast(orderType: "buy" | "sell") {
    return toast.loading(`Filling ${orderType} order...`, { id: `fill-order` });
}

/**
 * Show order cancel toast
 */
export function showOrderCancelToast() {
    return toast.loading("Cancelling order...", { id: "cancel-order" });
}

/**
 * Show withdrawal toast
 */
export function showWithdrawalToast() {
    return toast.loading("Processing withdrawal...", { id: "withdraw" });
}

/**
 * Update toast to success
 */
export function updateToastSuccess(toastId: string, message: string) {
    toast.success(message, { id: toastId });
}

/**
 * Update toast to error
 */
export function updateToastError(toastId: string, message: string) {
    toast.error(message, { id: toastId });
}

/**
 * Show info toast
 */
export function showInfoToast(message: string, duration = 4000) {
    toast(message, {
        icon: "ℹ️",
        duration,
        style: {
            background: "#1f2937",
            color: "#fff",
            border: "1px solid #3b82f6",
        },
    });
}

/**
 * Show warning toast
 */
export function showWarningToast(message: string, duration = 5000) {
    toast(message, {
        icon: "⚠️",
        duration,
        style: {
            background: "#1f2937",
            color: "#fff",
            border: "1px solid #f59e0b",
        },
    });
}

/**
 * Copy to clipboard with toast
 */
export function copyToClipboard(text: string, label = "Address") {
    navigator.clipboard.writeText(text);
    toast.success(`📋 ${label} copied to clipboard!`, { duration: 2000 });
}
