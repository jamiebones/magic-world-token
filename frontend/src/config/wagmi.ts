import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bsc, bscTestnet } from 'wagmi/chains';
import { http } from 'viem';
import EventEmitter from 'events';

// Increase max listeners to prevent memory leak warnings
// This is needed because we have multiple event watchers across different pages
EventEmitter.defaultMaxListeners = 20;

// Configure chains with custom RPC URLs for better reliability
const customBscTestnet = {
  ...bscTestnet,
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/']
    },
    public: {
      http: [process.env.NEXT_PUBLIC_BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/']
    }
  }
};

const customBsc = {
  ...bsc,
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org/']
    },
    public: {
      http: [process.env.NEXT_PUBLIC_BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org/']
    }
  }
};

// Create config once and export as singleton to prevent re-initialization
export const config = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Magic World',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [customBsc, customBscTestnet],
  transports: {
    [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org/'),
    [bscTestnet.id]: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/')
  },
  ssr: true,
});
