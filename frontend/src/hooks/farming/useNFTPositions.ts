import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { PANCAKESWAP_V3, CONTRACT_ADDRESSES } from "@/config/contracts";
import INonfungiblePositionManagerABI from "@/abis/INonfungiblePositionManager.json";
import type { NFTPosition } from "@/types/farming";
import type { Address } from "viem";

/**
 * Get details of a specific NFT position from Position Manager
 * @param tokenId NFT token ID
 */
export function useNFTPositionDetails(tokenId?: bigint) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: PANCAKESWAP_V3.POSITION_MANAGER,
    abi: INonfungiblePositionManagerABI,
    functionName: "positions",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  const position: NFTPosition | undefined = data
    ? (() => {
        const result = data as readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint];
        return {
          tokenId: tokenId!,
          nonce: result[0],
          operator: result[1],
          token0: result[2],
          token1: result[3],
          fee: Number(result[4]),
          tickLower: Number(result[5]),
          tickUpper: Number(result[6]),
          liquidity: result[7],
          feeGrowthInside0LastX128: result[8],
          feeGrowthInside1LastX128: result[9],
          tokensOwed0: result[10],
          tokensOwed1: result[11],
        };
      })()
    : undefined;

  return {
    position,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Check if farming contract is approved to manage user's NFTs
 * @param address User's wallet address
 */
export function useNFTApproval(address?: Address) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: PANCAKESWAP_V3.POSITION_MANAGER,
    abi: INonfungiblePositionManagerABI,
    functionName: "isApprovedForAll",
    args:
      address
        ? [address, CONTRACT_ADDRESSES.FARMING_POOL]
        : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    isApproved: data as boolean | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Approve farming contract to manage user's NFTs
 * @returns writeContract function and transaction state
 */
export function useApproveNFT() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approveNFT = () => {
    writeContract({
      address: PANCAKESWAP_V3.POSITION_MANAGER,
      abi: INonfungiblePositionManagerABI,
      functionName: "setApprovalForAll",
      args: [CONTRACT_ADDRESSES.FARMING_POOL, true],
    });
  };

  return {
    approveNFT,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Check owner of an NFT position
 * @param tokenId NFT token ID
 */
export function useNFTOwner(tokenId?: bigint) {
  const { data, isLoading, error } = useReadContract({
    address: PANCAKESWAP_V3.POSITION_MANAGER,
    abi: INonfungiblePositionManagerABI,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  return {
    owner: data as Address | undefined,
    isLoading,
    error,
  };
}

/**
 * Filter NFT positions that belong to MWG/BNB pool
 * @param positions Array of NFT positions
 */
export function useFilterMWGPositions(positions: NFTPosition[]) {
  const mwgToken = CONTRACT_ADDRESSES.TOKEN;
  const wbnb = PANCAKESWAP_V3.WBNB;

  const mwgPositions = positions.filter((position) => {
    // Check if position contains both MWG and BNB tokens (order independent)
    const hasMWG = position.token0 === mwgToken || position.token1 === mwgToken;
    const hasWBNB = position.token0 === wbnb || position.token1 === wbnb;
    
    return hasMWG && hasWBNB && position.liquidity > BigInt(0);
  });

  return mwgPositions;
}

/**
 * Combined hook to check if user owns an NFT and if it's approved
 * @param tokenId NFT token ID
 */
export function useNFTOwnershipAndApproval(tokenId?: bigint) {
  const { address } = useAccount();
  const { owner, isLoading: isLoadingOwner } = useNFTOwner(tokenId);
  const { isApproved, isLoading: isLoadingApproval } = useNFTApproval(address);

  const isOwner = address && owner ? address.toLowerCase() === owner.toLowerCase() : false;

  return {
    isOwner,
    isApproved: isApproved ?? false,
    isLoading: isLoadingOwner || isLoadingApproval,
    needsApproval: isOwner && !isApproved,
  };
}
