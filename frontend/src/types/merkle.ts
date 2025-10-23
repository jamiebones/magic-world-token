/**
 * Merkle Distribution Types
 * Types for Merkle tree-based token distributions
 */

export enum VaultType {
  PLAYER_TASKS = 'PLAYER_TASKS',
  SOCIAL_FOLLOWERS = 'SOCIAL_FOLLOWERS',
  SOCIAL_POSTERS = 'SOCIAL_POSTERS',
  ECOSYSTEM_FUND = 'ECOSYSTEM_FUND',
}

export enum DistributionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface Allocation {
  address: string;
  amount: number;
}

export interface MerkleDistribution {
  distributionId: number;
  merkleRoot: string;
  vaultType: VaultType;
  totalAmount: number;
  totalRecipients: number;
  claimedCount: number;
  claimedAmount: number;
  remainingAmount: number;
  startTime: number;
  endTime: number;
  status: DistributionStatus;
  transactionHash?: string;
  blockNumber?: number;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    syncedFromBlockchain: boolean;
    lastSyncedAt?: string;
  };
}

export interface MerkleLeaf {
  address: string;
  amount: number;
  index: number;
  claimed: boolean;
  claimedAt?: string;
  claimTransactionHash?: string;
}

export interface MerkleProof {
  address: string;
  amount: number;
  proof: string[];
  index: number;
}

export interface DistributionEligibility {
  eligible: boolean;
  allocation?: {
    address: string;
    amount: number;
    claimed: boolean;
  };
}

export interface CreateDistributionRequest {
  allocations: Allocation[];
  vaultType: VaultType;
  durationInDays: number;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
}

export interface CreateDistributionResponse {
  distribution: MerkleDistribution;
  transactionHash: string;
  merkleTree: {
    root: string;
    leaves: number;
  };
}

export interface DistributionFilters {
  status?: DistributionStatus;
  vaultType?: VaultType;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DistributionListResponse {
  distributions: MerkleDistribution[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  allocations?: Allocation[];
  totalAmount?: number;
  totalRecipients?: number;
  errors?: Array<{
    field: string;
    message: string;
    index?: number;
  }>;
}

export interface DistributionStats {
  total: number;
  active: number;
  completed: number;
  totalDistributed: number;
  totalClaimed: number;
  totalRecipients: number;
  byVaultType: {
    [key in VaultType]?: {
      count: number;
      distributed: number;
      claimed: number;
    };
  };
}
