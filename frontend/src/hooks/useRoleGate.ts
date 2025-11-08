import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, DEFAULT_CHAIN_ID } from '@/config/contracts';
import MagicWorldTokenABI from '@/abis/MagicWorldToken.json';
import MagicWorldGameABI from '@/abis/MagicWorldGame.json';
import PartnerVaultABI from '@/abis/PartnerVault.json';
import { keccak256, toBytes } from 'viem';

type ContractType = 'token' | 'game' | 'vault';

interface UseRoleGateProps {
  contract: ContractType;
  roleConstant: string;
}

const CONTRACTS = {
  token: { address: CONTRACT_ADDRESSES.TOKEN as `0x${string}`, abi: MagicWorldTokenABI.abi },
  game: { address: CONTRACT_ADDRESSES.GAME as `0x${string}`, abi: MagicWorldGameABI.abi },
  vault: { address: CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`, abi: PartnerVaultABI.abi },
};

// Pre-computed role hashes to avoid contract calls
const ROLE_HASHES: Record<string, `0x${string}`> = {
  'DEFAULT_ADMIN_ROLE': '0x0000000000000000000000000000000000000000000000000000000000000000',
  'GAME_ADMIN_ROLE': keccak256(toBytes('GAME_ADMIN_ROLE')),
  'REWARD_DISTRIBUTOR_ROLE': keccak256(toBytes('REWARD_DISTRIBUTOR_ROLE')),
  'PAUSE_ROLE': keccak256(toBytes('PAUSE_ROLE')),
  'GAME_OPERATOR_ROLE': keccak256(toBytes('GAME_OPERATOR_ROLE')),
  'BLACKLIST_MANAGER_ROLE': keccak256(toBytes('BLACKLIST_MANAGER_ROLE')),
  'ADMIN_ROLE': keccak256(toBytes('ADMIN_ROLE')),
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

  // Use pre-computed role hash instead of fetching from contract
  const roleHash = ROLE_HASHES[roleConstant];

  console.log(`🔍 useRoleGate - ${contract} / ${roleConstant}:`, {
    contractAddress: contractConfig.address,
    userAddress: address,
    isConnected,
    roleHash,
    hasContractAddress: !!contractConfig.address,
    hasUserAddress: !!address,
    hasRoleHash: !!roleHash,
    abiLength: contractConfig.abi?.length,
  });

  // Check if the address has that role
  const { data: hasRole, isLoading, refetch, error } = useReadContract({
    address: contractConfig.address,
    abi: contractConfig.abi,
    functionName: 'hasRole',
    args: roleHash && address ? [roleHash, address] : undefined,
    chainId: DEFAULT_CHAIN_ID,
    query: {
      enabled: isConnected && !!address && !!roleHash && !!contractConfig.address,
    },
  });

  console.log(`✅ Role check result ${contract}/${roleConstant}:`, {
    hasRole,
    isLoading,
    error: error?.message,
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
 * Hook to check if user has blacklist manager role on token contract
 */
export function useHasBlacklistManagerRole() {
  return useRoleGate({ contract: 'token', roleConstant: 'BLACKLIST_MANAGER_ROLE' });
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
    rewardDistributor.hasRole ||
    pauseRole.hasRole ||
    vaultAdmin.hasRole ||
    vaultDefaultAdmin.hasRole;

  // Debug logging
  if (isConnected && !isAnyLoading) {
    console.log('🔐 Role Check Debug:', {
      address,
      isConnected,
      isAnyLoading,
      hasAnyAdminRole,
      roles: {
        tokenAdmin: tokenAdmin.hasRole,
        gameAdmin: gameAdmin.hasRole,
        gameDefaultAdmin: gameDefaultAdmin.hasRole,
        rewardDistributor: rewardDistributor.hasRole,
        pauseRole: pauseRole.hasRole,
        vaultAdmin: vaultAdmin.hasRole,
        vaultDefaultAdmin: vaultDefaultAdmin.hasRole,
      }
    });
  }

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
