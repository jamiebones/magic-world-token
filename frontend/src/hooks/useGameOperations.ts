import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { MagicWorldGameABI } from '@/abis';
import { parseEther } from 'viem';

/**
 * Hook for distributing tokens from vault with different amounts
 */
export function useDistributeFromVault() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const distributeFromVault = async (
    vaultType: number,
    recipients: `0x${string}`[],
    amounts: string[],
    reason: string
  ) => {
    const amountsInWei = amounts.map((amount) => parseEther(amount));

    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'distributeFromVault',
      args: [vaultType, recipients, amountsInWei, reason],
    });
  };

  return {
    distributeFromVault,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}

/**
 * Hook for distributing equal amounts from vault
 */
export function useDistributeEqualFromVault() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const distributeEqualFromVault = async (
    vaultType: number,
    recipients: `0x${string}`[],
    amount: string,
    reason: string
  ) => {
    const amountInWei = parseEther(amount);

    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'distributeEqualFromVault',
      args: [vaultType, recipients, amountInWei, reason],
    });
  };

  return {
    distributeEqualFromVault,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}

/**
 * Hook for updating game configuration
 */
export function useUpdateGameConfig() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setDailyRewardLimit = async (newLimit: string) => {
    const limitInWei = parseEther(newLimit);
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'setDailyRewardLimit',
      args: [limitInWei],
    });
  };

  const setMaxBatchSize = async (newSize: number) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'setMaxBatchSize',
      args: [BigInt(newSize)],
    });
  };

  const setCooldownPeriod = async (newPeriod: number) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'setCooldownPeriod',
      args: [BigInt(newPeriod)],
    });
  };

  return {
    setDailyRewardLimit,
    setMaxBatchSize,
    setCooldownPeriod,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}

/**
 * Hook for emergency operations on game contract
 */
export function useGameEmergency() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const pause = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'pause',
    });
  };

  const unpause = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'unpause',
    });
  };

  const emergencyWithdraw = async (amount: string) => {
    const amountInWei = parseEther(amount);
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'emergencyWithdraw',
      args: [amountInWei],
    });
  };

  return {
    pause,
    unpause,
    emergencyWithdraw,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}

/**
 * Hook for managing game roles
 */
export function useGameRoles() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const grantDistributorRole = async (account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'grantDistributorRole',
      args: [account],
    });
  };

  const revokeDistributorRole = async (account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'revokeDistributorRole',
      args: [account],
    });
  };

  const grantGameAdminRole = async (account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'grantGameAdminRole',
      args: [account],
    });
  };

  const revokeGameAdminRole = async (account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
      abi: MagicWorldGameABI,
      functionName: 'revokeGameAdminRole',
      args: [account],
    });
  };

  return {
    grantDistributorRole,
    revokeDistributorRole,
    grantGameAdminRole,
    revokeGameAdminRole,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}
