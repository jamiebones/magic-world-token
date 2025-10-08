import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { MagicWorldTokenABI, MagicWorldGameABI, PartnerVaultABI } from '@/abis';

type ContractType = 'token' | 'game' | 'vault';

interface UseRoleGateProps {
  contract: ContractType;
  roleConstant: string;
}

const CONTRACTS = {
  token: { address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`, abi: MagicWorldTokenABI },
  game: { address: CONTRACT_ADDRESSES.GAME as `0x${string}`, abi: MagicWorldGameABI },
  vault: { address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`, abi: PartnerVaultABI },
};

/**
 * Hook to check if connected wallet has a specific role on a contract
 * @param contract - Which contract to check ("token", "game", "vault")
 * @param roleConstant - Role constant name (e.g., "GAME_ADMIN_ROLE", "DEFAULT_ADMIN_ROLE")
 * @returns Object with hasRole and isLoading states
 */
export function useRoleGate({ contract, roleConstant }: UseRoleGateProps) {
  const { address, isConnected } = useAccount();
  const contractConfig = CONTRACTS[contract];

  // Get the role hash from the contract
  const { data: roleHash } = useReadContract({
    address: contractConfig.address,
    abi: contractConfig.abi,
    functionName: roleConstant,
    query: {
      enabled: isConnected && !!address,
    },
  }) as { data: `0x${string}` | undefined };

  // Check if the address has that role
  const { data: hasRole, isLoading, refetch } = useReadContract({
    address: contractConfig.address,
    abi: contractConfig.abi,
    functionName: 'hasRole',
    args: roleHash && address ? [roleHash as `0x${string}`, address] : undefined,
    query: {
      enabled: isConnected && !!address && !!roleHash,
    },
  });

  return {
    hasRole: hasRole as boolean ?? false,
    isLoading,
    isConnected,
    address,
    refetch,
  };
}

/**
 * Hook to check if user is default admin on any contract
 */
export function useIsDefaultAdmin(contract: ContractType) {
  return useRoleGate({ contract, roleConstant: 'DEFAULT_ADMIN_ROLE' });
}

/**
 * Hook to check if user is game admin
 */
export function useIsGameAdmin() {
  return useRoleGate({ contract: 'game', roleConstant: 'GAME_ADMIN_ROLE' });
}

/**
 * Hook to check if user is reward distributor
 */
export function useIsRewardDistributor() {
  return useRoleGate({ contract: 'game', roleConstant: 'REWARD_DISTRIBUTOR_ROLE' });
}

/**
 * Hook to check if user has pause role on token contract
 */
export function useHasPauseRole() {
  return useRoleGate({ contract: 'token', roleConstant: 'PAUSE_ROLE' });
}

/**
 * Hook to check if user has game operator role on token contract
 */
export function useHasGameOperatorRole() {
  return useRoleGate({ contract: 'token', roleConstant: 'GAME_OPERATOR_ROLE' });
}

/**
 * Hook to check if user has admin role on partner vault
 */
export function useIsPartnerVaultAdmin() {
  return useRoleGate({ contract: 'vault', roleConstant: 'ADMIN_ROLE' });
}

/**
 * Hook to check multiple roles at once
 */
export function useMultiRoleGate() {
  const { address, isConnected } = useAccount();
  
  const tokenAdmin = useIsDefaultAdmin('token');
  const gameAdmin = useIsGameAdmin();
  const gameDefaultAdmin = useIsDefaultAdmin('game');
  const rewardDistributor = useIsRewardDistributor();
  const pauseRole = useHasPauseRole();
  const vaultAdmin = useIsPartnerVaultAdmin();
  const vaultDefaultAdmin = useIsDefaultAdmin('vault');

  const isAnyLoading = 
    tokenAdmin.isLoading ||
    gameAdmin.isLoading ||
    gameDefaultAdmin.isLoading ||
    rewardDistributor.isLoading ||
    pauseRole.isLoading ||
    vaultAdmin.isLoading ||
    vaultDefaultAdmin.isLoading;

  const hasAnyAdminRole = 
    tokenAdmin.hasRole ||
    gameAdmin.hasRole ||
    gameDefaultAdmin.hasRole ||
    vaultAdmin.hasRole ||
    vaultDefaultAdmin.hasRole;

  return {
    roles: {
      tokenAdmin: tokenAdmin.hasRole,
      gameAdmin: gameAdmin.hasRole,
      gameDefaultAdmin: gameDefaultAdmin.hasRole,
      rewardDistributor: rewardDistributor.hasRole,
      pauseRole: pauseRole.hasRole,
      vaultAdmin: vaultAdmin.hasRole,
      vaultDefaultAdmin: vaultDefaultAdmin.hasRole,
    },
    isLoading: isAnyLoading,
    hasAnyAdminRole,
    isConnected,
    address,
  };
}
