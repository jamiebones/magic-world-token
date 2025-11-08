import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGFarmingPoolABI from "@/abis/MWGFarmingPool.json";

/**
 * Hook to deposit rewards into the farming pool
 * Requires REWARD_MANAGER_ROLE
 */
export function useDepositRewards() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const depositRewards = (amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "depositRewards",
      args: [amount],
    });
  };

  return {
    depositRewards,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to set reward rate
 * Requires ADMIN_ROLE
 */
export function useSetRewardRate() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const setRewardRate = (newRate: bigint) => {
    // Validate rate <= 1e18
    if (newRate > BigInt(1e18)) {
      throw new Error("Reward rate cannot exceed 1e18 per second");
    }

    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "setRewardRate",
      args: [newRate],
    });
  };

  return {
    setRewardRate,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to extend farming period
 * Requires ADMIN_ROLE
 */
export function useExtendFarming() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const extendFarming = (additionalSeconds: bigint) => {
    // Validate max 5 years extension
    const fiveYears = BigInt(5 * 365 * 24 * 60 * 60);
    if (additionalSeconds > fiveYears) {
      throw new Error("Cannot extend farming period beyond 5 years");
    }

    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "extendFarming",
      args: [additionalSeconds],
    });
  };

  return {
    extendFarming,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to pause/unpause contract
 * Requires PAUSE_ROLE
 */
export function useSetPaused() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const setPaused = (paused: boolean) => {
    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "setPaused",
      args: [paused],
    });
  };

  return {
    setPaused,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to enable emergency withdraw
 * Requires ADMIN_ROLE
 * WARNING: This action is IRREVERSIBLE
 */
export function useEnableEmergencyWithdraw() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const enableEmergencyWithdraw = (confirmation: string) => {
    // Require explicit confirmation
    if (confirmation !== "I UNDERSTAND THIS IS IRREVERSIBLE") {
      throw new Error("Invalid confirmation string");
    }

    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "enableEmergencyWithdraw",
    });
  };

  return {
    enableEmergencyWithdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to emergency withdraw rewards
 * Requires ADMIN_ROLE
 * Only works if emergency withdraw is enabled
 */
export function useEmergencyWithdrawRewards() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const emergencyWithdrawRewards = (amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.FARMING_POOL,
      abi: MWGFarmingPoolABI,
      functionName: "emergencyWithdrawRewards",
      args: [amount],
    });
  };

  return {
    emergencyWithdrawRewards,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to approve MWG tokens before depositing rewards
 */
export function useApproveMWGForFarming() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  const approveMWG = (amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.TOKEN, // MWG token address
      abi: [
        {
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.FARMING_POOL, amount],
    });
  };

  return {
    approveMWG,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
