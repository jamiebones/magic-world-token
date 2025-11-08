import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGFarmingPoolABI from "@/abis/MWGFarmingPool.json";

/**
 * Stake a PancakeSwap V3 NFT position
 * @returns writeContract function and transaction state
 */
export function useStakePosition() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const stakePosition = (tokenId: bigint, lockDays: number) => {
    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "stakePosition",
      args: [tokenId, BigInt(lockDays)],
    });
  };

  return {
    stakePosition,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Unstake a position and claim rewards
 * @returns writeContract function and transaction state
 */
export function useUnstakePosition() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const unstakePosition = (tokenId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "unstakePosition",
      args: [tokenId],
    });
  };

  return {
    unstakePosition,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Claim rewards for specific positions
 * @returns writeContract function and transaction state
 */
export function useClaimRewards() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimRewards = (tokenIds: bigint[]) => {
    if (tokenIds.length === 0) {
      throw new Error("No positions specified");
    }
    if (tokenIds.length > 50) {
      throw new Error("Cannot claim more than 50 positions at once");
    }

    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "claimRewards",
      args: [tokenIds],
    });
  };

  return {
    claimRewards,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Claim all rewards for user's positions
 * @returns writeContract function and transaction state
 */
export function useClaimAllRewards() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimAllRewards = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "claimAllRewards",
    });
  };

  return {
    claimAllRewards,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Emergency unstake (no rewards, only when emergency mode enabled)
 * @returns writeContract function and transaction state
 */
export function useEmergencyUnstake() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const emergencyUnstake = (tokenId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "emergencyUnstake",
      args: [tokenId],
    });
  };

  return {
    emergencyUnstake,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
