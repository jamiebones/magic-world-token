import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { PartnerVaultABI } from '@/abis';
import { parseEther, Address } from 'viem';

export interface PartnerInfo {
  address: Address;
  amount: bigint;
  allocatedAt: bigint;
  withdrawn: boolean;
  withdrawableAt: bigint;
}

/**
 * Hook to fetch all partners with pagination
 */
export function usePartnersList(offset: number = 0, limit: number = 10) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PARTNER_VAULT as Address,
    abi: PartnerVaultABI,
    functionName: 'getPartnersWithDetails',
    args: [BigInt(offset), BigInt(limit)],
  });

  const partners: PartnerInfo[] = data
    ? (data as [Address[], bigint[], bigint[], boolean[], bigint[]]).reduce(
        (acc: PartnerInfo[], _, index) => {
          const [addresses, amounts, allocatedAts, withdrawns, withdrawableAts] =
            data as [Address[], bigint[], bigint[], boolean[], bigint[]];
          
          if (addresses[index]) {
            acc.push({
              address: addresses[index],
              amount: amounts[index],
              allocatedAt: allocatedAts[index],
              withdrawn: withdrawns[index],
              withdrawableAt: withdrawableAts[index],
            });
          }
          return acc;
        },
        []
      )
    : [];

  return {
    partners,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get total partner count
 */
export function usePartnerCount() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PARTNER_VAULT as Address,
    abi: PartnerVaultABI,
    functionName: 'getPartnerCount',
  });

  return {
    count: data ? Number(data) : 0,
    isLoading,
    error,
    refetch,
  };
}

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
