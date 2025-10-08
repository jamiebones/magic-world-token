import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { PartnerVaultABI } from '@/abis';
import { parseEther } from 'viem';

/**
 * Hook for allocating tokens to partners
 */
export function useAllocateToPartner() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const allocateToPartner = async (partner: `0x${string}`, amount: string) => {
    const amountInWei = parseEther(amount);

    return writeContract({
      address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
      abi: PartnerVaultABI,
      functionName: 'allocateToPartner',
      args: [partner, amountInWei],
    });
  };

  return {
    allocateToPartner,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
  };
}

/**
 * Hook for partner vault emergency operations
 */
export function usePartnerVaultEmergency() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const pause = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
      abi: PartnerVaultABI,
      functionName: 'pause',
    });
  };

  const unpause = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
      abi: PartnerVaultABI,
      functionName: 'unpause',
    });
  };

  const emergencyWithdraw = async (partner: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
      abi: PartnerVaultABI,
      functionName: 'emergencyWithdraw',
      args: [partner],
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
