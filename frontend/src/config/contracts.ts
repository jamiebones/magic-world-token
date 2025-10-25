// Contract addresses
export const CONTRACT_ADDRESSES = {
  TOKEN: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
  GAME: process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}`,
  PARTNER_VAULT: process.env.NEXT_PUBLIC_PARTNER_VAULT_ADDRESS as `0x${string}`,
} as const;

// Debug logging
if (typeof window !== 'undefined') {
  console.log('📋 Contract Addresses Loaded:', {
    TOKEN: CONTRACT_ADDRESSES.TOKEN,
    GAME: CONTRACT_ADDRESSES.GAME,
    PARTNER_VAULT: CONTRACT_ADDRESSES.PARTNER_VAULT,
  });
}

// Chain configuration
export const SUPPORTED_CHAINS = {
  BSC_MAINNET: 56,
  BSC_TESTNET: 97,
} as const;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || SUPPORTED_CHAINS.BSC_MAINNET;

// Vault types enum (matching smart contract)
export enum VaultType {
  PLAYER_TASKS = 0,
  SOCIAL_FOLLOWERS = 1,
  SOCIAL_POSTERS = 2,
  ECOSYSTEM_FUND = 3,
}

export const VAULT_NAMES = {
  [VaultType.PLAYER_TASKS]: 'Player Tasks',
  [VaultType.SOCIAL_FOLLOWERS]: 'Social Followers',
  [VaultType.SOCIAL_POSTERS]: 'Social Posters',
  [VaultType.ECOSYSTEM_FUND]: 'Ecosystem Fund',
} as const;
