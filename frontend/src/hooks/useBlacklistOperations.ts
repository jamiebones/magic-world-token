"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import MagicWorldTokenABI from "@/abis/MagicWorldToken.json";
import { CONTRACT_ADDRESSES } from "@/config/contracts";

export function useBlacklistOperations() {
  const [isPending, setIsPending] = useState(false);

  const { writeContract, data: hash, error, isPending: isWritePending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Blacklist single address
  const blacklistAddress = async (address: string, reason: string) => {
    try {
      setIsPending(true);
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
        abi: MagicWorldTokenABI.abi,
        functionName: "blacklistAddress",
        args: [address, reason],
      });
    } catch (err) {
      console.error("Error blacklisting address:", err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  // Batch blacklist addresses
  const blacklistAddresses = async (addresses: string[], reason: string) => {
    try {
      setIsPending(true);
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
        abi: MagicWorldTokenABI.abi,
        functionName: "blacklistAddresses",
        args: [addresses, reason],
      });
    } catch (err) {
      console.error("Error batch blacklisting:", err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  // Request unblacklist
  const requestUnblacklist = async (address: string) => {
    try {
      setIsPending(true);
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
        abi: MagicWorldTokenABI.abi,
        functionName: "requestUnblacklist",
        args: [address],
      });
    } catch (err) {
      console.error("Error requesting unblacklist:", err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  // Execute unblacklist
  const executeUnblacklist = async (address: string) => {
    try {
      setIsPending(true);
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
        abi: MagicWorldTokenABI.abi,
        functionName: "executeUnblacklist",
        args: [address],
      });
    } catch (err) {
      console.error("Error executing unblacklist:", err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  // Cancel unblacklist request
  const cancelUnblacklistRequest = async (address: string) => {
    try {
      setIsPending(true);
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
        abi: MagicWorldTokenABI.abi,
        functionName: "cancelUnblacklistRequest",
        args: [address],
      });
    } catch (err) {
      console.error("Error canceling unblacklist request:", err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  // Set unblacklist timelock
  const setUnblacklistTimelock = async (newTimelock: number) => {
    try {
      setIsPending(true);
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
        abi: MagicWorldTokenABI.abi,
        functionName: "setUnblacklistTimelock",
        args: [BigInt(newTimelock)],
      });
    } catch (err) {
      console.error("Error setting timelock:", err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return {
    blacklistAddress,
    blacklistAddresses,
    requestUnblacklist,
    executeUnblacklist,
    cancelUnblacklistRequest,
    setUnblacklistTimelock,
    hash,
    isPending: isPending || isWritePending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to check if address is blacklisted
export function useIsBlacklisted(address: string | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI.abi,
    functionName: "isBlacklisted",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    isBlacklisted: data as boolean | undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get blacklist info
export function useBlacklistInfo(address: string | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI.abi,
    functionName: "getBlacklistInfo",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const result = data as [boolean, bigint, bigint] | undefined;

  return {
    blacklistInfo: result
      ? {
          blacklisted: result[0],
          blacklistedAt: Number(result[1]),
          unblacklistRequestTime: Number(result[2]),
        }
      : undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get unblacklist timelock
export function useUnblacklistTimelock() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI.abi,
    functionName: "unblacklistTimelock",
  });

  return {
    timelock: data ? Number(data) : undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to get max blacklist batch size
export function useMaxBlacklistBatchSize() {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI.abi,
    functionName: "MAX_BLACKLIST_BATCH_SIZE",
  });

  return {
    maxBatchSize: data ? Number(data) : 100,
    isLoading,
    error,
  };
}
