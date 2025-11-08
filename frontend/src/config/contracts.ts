// Contract addresses
export const CONTRACT_ADDRESSES = {
  TOKEN: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
  GAME: process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}`,
  PARTNER_VAULT: process.env.NEXT_PUBLIC_PARTNER_VAULT_ADDRESS as `0x${string}`,
  FARMING_POOL: process.env.NEXT_PUBLIC_FARMING_POOL_ADDRESS as `0x${string}`,
  MWG_BNB_POOL: process.env.NEXT_PUBLIC_MWG_BNB_POOL_ADDRESS as `0x${string}`,
} as const;

// Debug logging
if (typeof window !== 'undefined') {
  console.log('📋 Contract Addresses Loaded:', {
    TOKEN: CONTRACT_ADDRESSES.TOKEN,
    GAME: CONTRACT_ADDRESSES.GAME,
    PARTNER_VAULT: CONTRACT_ADDRESSES.PARTNER_VAULT,
    FARMING_POOL: CONTRACT_ADDRESSES.FARMING_POOL,
    MWG_BNB_POOL: CONTRACT_ADDRESSES.MWG_BNB_POOL,
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

// PancakeSwap V3 Contracts
export const PANCAKESWAP_V3 = {
  FACTORY: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as `0x${string}`,
  POSITION_MANAGER: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364" as `0x${string}`,
  ROUTER: "0x1b81D678ffb9C0263b24A97847620C99d213eB14" as `0x${string}`,
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as `0x${string}`,
} as const;

export const FEE_TIERS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 2500,   // 0.25%
  HIGH: 10000,    // 1%
} as const;

// Network-aware helpers
const WBNB_BY_CHAIN: Record<number, `0x${string}`> = {
  [SUPPORTED_CHAINS.BSC_MAINNET]: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  [SUPPORTED_CHAINS.BSC_TESTNET]: "0xae13d989dac2f0debff460ac112a837c89baa7cd",
};

export function getWBNBAddress(chainId?: number): `0x${string}` {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  return (WBNB_BY_CHAIN[id] ?? PANCAKESWAP_V3.WBNB) as `0x${string}`;
}

// Farming Pool Configuration
export const FARMING_CONFIG = {
  MAX_BATCH_SIZE: 50,
  MAX_LOCK_DAYS: 365,
  BASE_MULTIPLIER: 1000,
  LOCK_TIERS: [
    { days: 0, multiplier: 1000, label: "No Lock", boost: "1.0x" },
    { days: 7, multiplier: 1050, label: "1 Week", boost: "1.05x" },
    { days: 30, multiplier: 1100, label: "1 Month", boost: "1.1x" },
    { days: 90, multiplier: 1250, label: "3 Months", boost: "1.25x" },
    { days: 180, multiplier: 1500, label: "6 Months", boost: "1.5x" },
    { days: 365, multiplier: 2000, label: "1 Year", boost: "2.0x" },
  ],
} as const;
