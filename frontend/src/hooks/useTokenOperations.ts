import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { MagicWorldTokenABI } from '@/abis';

/**
 * Hook for token emergency operations
 */
export function useTokenEmergency() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const pause = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
      abi: MagicWorldTokenABI,
      functionName: 'pause',
    });
  };

  const unpause = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
      abi: MagicWorldTokenABI,
      functionName: 'unpause',
    });
  };

  return {
    pause,
    unpause,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}

/**
 * Hook for managing token contract roles
 */
export function useTokenRoles() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const grantRole = async (role: `0x${string}`, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
      abi: MagicWorldTokenABI,
      functionName: 'grantRole',
      args: [role, account],
    });
  };

  const revokeRole = async (role: `0x${string}`, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
      abi: MagicWorldTokenABI,
      functionName: 'revokeRole',
      args: [role, account],
    });
  };

  return {
    grantRole,
    revokeRole,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}

/**
 * Hook for managing vault contract roles
 */
export function useVaultRoles() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const grantRole = async (role: `0x${string}`, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
      abi: MagicWorldTokenABI,
      functionName: 'grantRole',
      args: [role, account],
    });
  };

  const revokeRole = async (role: `0x${string}`, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
      abi: MagicWorldTokenABI,
      functionName: 'revokeRole',
      args: [role, account],
    });
  };

  return {
    grantRole,
    revokeRole,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}
