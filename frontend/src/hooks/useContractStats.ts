import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { MagicWorldTokenABI, MagicWorldGameABI, PartnerVaultABI } from '@/abis';
import { formatEther } from 'viem';

/**
 * Hook to fetch token contract statistics
 */
export function useTokenStats() {
  const { data: totalSupply, isLoading: totalSupplyLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI,
    functionName: 'totalSupply',
  });

  const { data: paused, isLoading: pausedLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI,
    functionName: 'paused',
  });

  const { data: name } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI,
    functionName: 'name',
  });

  const { data: symbol } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI,
    functionName: 'symbol',
  });

  const { data: maxBatchSize } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI,
    functionName: 'getMaxBatchSize',
  });

  return {
    totalSupply: totalSupply ? formatEther(totalSupply as bigint) : '0',
    paused: paused as boolean ?? false,
    name: name as string,
    symbol: symbol as string,
    maxBatchSize: maxBatchSize?.toString() || '200',
    isLoading: totalSupplyLoading || pausedLoading,
  };
}

/**
 * Hook to fetch game contract statistics
 */
export function useGameStats() {
  const { data: stats, isLoading: statsLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'getContractStats',
  });

  const { data: dailyLimit } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'dailyRewardLimit',
  });

  const { data: maxBatchSize } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'maxBatchSize',
  });

  const { data: cooldownPeriod } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'cooldownPeriod',
  });

  const { data: paused } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'paused',
  });

  const { data: vaultsInitialized } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'vaultsInitialized',
  });

  const [totalDistributed, playersCount, gameBalance] = (stats as [bigint, bigint, bigint]) || [BigInt(0), BigInt(0), BigInt(0)];

  return {
    totalDistributed: formatEther(totalDistributed),
    playersCount: playersCount?.toString() || '0',
    gameBalance: formatEther(gameBalance),
    dailyLimit: dailyLimit ? formatEther(dailyLimit as bigint) : '0',
    maxBatchSize: maxBatchSize?.toString() || '0',
    cooldownPeriod: cooldownPeriod?.toString() || '0',
    cooldownHours: cooldownPeriod ? (Number(cooldownPeriod) / 3600).toFixed(1) : '0',
    paused: paused as boolean ?? false,
    vaultsInitialized: vaultsInitialized as boolean ?? false,
    isLoading: statsLoading,
  };
}

/**
 * Hook to fetch all vault statistics
 */
export function useVaultStats() {
  const { data: vaultStats, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'getAllVaultStats',
  });

  if (!vaultStats || isLoading) {
    return {
      vaults: [],
      isLoading: true,
      refetch,
    };
  }

  const vaultTypes = ['Player Tasks', 'Social Followers', 'Social Posters', 'Ecosystem Fund'];

  type VaultData = { totalAllocated: bigint; spent: bigint; remaining: bigint };
  const formattedVaults = (vaultStats as VaultData[]).map((vault, index) => {
    const totalAllocated = vault.totalAllocated as bigint;
    const spent = vault.spent as bigint;
    const remaining = vault.remaining as bigint;
    
    const percentSpent =
      totalAllocated > BigInt(0)
      ? Number((spent * BigInt(10000)) / totalAllocated) / 100
      : 0;

    return {
      type: vaultTypes[index],
      typeId: index,
      totalAllocated: formatEther(totalAllocated),
      spent: formatEther(spent),
      remaining: formatEther(remaining),
      spentPercentage: percentSpent,
    };
  });

  return {
    vaults: formattedVaults,
    isLoading: false,
    refetch,
  };
}

/**
 * Hook to fetch partner vault statistics
 */
export function usePartnerVaultStats() {
  const { data: totalAllocated, isLoading: totalLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
    abi: PartnerVaultABI,
    functionName: 'getTotalAllocated',
  });

  const { data: vaultBalance, isLoading: balanceLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI,
    functionName: 'balanceOf',
    args: [CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`],
  });

  const { data: paused } = useReadContract({
    address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
    abi: PartnerVaultABI,
    functionName: 'paused',
  });

  const { data: lockupPeriod } = useReadContract({
    address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`,
    abi: PartnerVaultABI,
    functionName: 'LOCKUP_PERIOD',
  });

  const totalAllocatedBigInt = (totalAllocated as bigint) || BigInt(0);
  const vaultBalanceBigInt = (vaultBalance as bigint) || BigInt(0);
  const unallocatedBigInt = vaultBalanceBigInt - totalAllocatedBigInt;

  return {
    totalAllocated: formatEther(totalAllocatedBigInt),
    vaultBalance: formatEther(vaultBalanceBigInt),
    unallocated: formatEther(unallocatedBigInt > BigInt(0) ? unallocatedBigInt : BigInt(0)),
    paused: paused as boolean ?? false,
    lockupPeriod: lockupPeriod?.toString() || '94608000', // 3 years in seconds
    lockupYears: lockupPeriod ? (Number(lockupPeriod) / (365 * 24 * 3600)).toFixed(1) : '3',
    isLoading: totalLoading || balanceLoading,
  };
}

/**
 * Hook to check token balance for any address
 */
export function useTokenBalance(address?: `0x${string}`) {
  const { data: balance, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`,
    abi: MagicWorldTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: balance ? formatEther(balance as bigint) : '0',
    balanceRaw: balance as bigint,
    isLoading,
    refetch,
  };
}

/**
 * Hook to fetch player statistics
 */
export function usePlayerStats(playerAddress?: `0x${string}`) {
  const { data: stats, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.GAME as `0x${string}`,
    abi: MagicWorldGameABI,
    functionName: 'getPlayerStats',
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: !!playerAddress,
    },
  });

  const [dailyReceived, totalEarned, lastReward] = (stats as [bigint, bigint, bigint]) || [BigInt(0), BigInt(0), BigInt(0)];

  return {
    dailyReceived: formatEther(dailyReceived),
    totalEarned: formatEther(totalEarned),
    lastReward: lastReward ? new Date(Number(lastReward) * 1000) : null,
    lastRewardTimestamp: lastReward?.toString() || '0',
    isLoading,
  };
}
