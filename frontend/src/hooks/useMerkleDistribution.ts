/**
 * Merkle Distribution Hooks
 * React hooks for Merkle distribution operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { merkleAPI } from '@/lib/merkleAPI';
import type {
  MerkleDistribution,
  DistributionFilters,
  CreateDistributionRequest,
  Allocation,
  MerkleProof,
  DistributionEligibility,
  MerkleLeaf,
} from '@/types/merkle';

// Type for API errors
type APIError = {
  response?: {
    data?: {
      error?: {
        message?: string;
      };
    };
  };
};

/**
 * Hook to fetch all distributions with optional filters
 */
export function useDistributions(filters?: DistributionFilters) {
  const [distributions, setDistributions] = useState<MerkleDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });

  // Use ref to track if we've mounted to prevent double-fetch on initial render
  const isMounted = useRef(false);
  const lastFiltersRef = useRef<string>('');

  const fetchDistributions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await merkleAPI.getDistributions(filters);
      setDistributions(data.distributions);
      setPagination(data.pagination);
      if (initialLoad) {
        setInitialLoad(false);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to fetch distributions');
      if (initialLoad) {
        setInitialLoad(false);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, initialLoad]);

  useEffect(() => {
    // Serialize filters to detect actual changes
    const filtersString = JSON.stringify(filters || {});
    
    // Skip if filters haven't changed
    if (isMounted.current && filtersString === lastFiltersRef.current) {
      return;
    }

    lastFiltersRef.current = filtersString;
    isMounted.current = true;
    
    fetchDistributions();
  }, [filters, fetchDistributions]);

  return {
    distributions,
    loading,
    initialLoad,
    error,
    pagination,
    refetch: fetchDistributions,
  };
}

/**
 * Hook to fetch a single distribution by ID
 */
export function useDistribution(distributionId: number | null) {
  const [distribution, setDistribution] = useState<MerkleDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDistribution = useCallback(async () => {
    if (!distributionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await merkleAPI.getDistribution(distributionId);
      setDistribution(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to fetch distribution');
    } finally {
      setLoading(false);
    }
  }, [distributionId]);

  useEffect(() => {
    fetchDistribution();
  }, [fetchDistribution]);

  return {
    distribution,
    loading,
    error,
    refetch: fetchDistribution,
  };
}

/**
 * Hook to fetch user's distributions
 */
export function useUserDistributions() {
  const { address } = useAccount();
  const [distributions, setDistributions] = useState<MerkleDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDistributions = useCallback(async () => {
    if (!address) {
      setLoading(false);
      setInitialLoad(false);
      setDistributions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await merkleAPI.getUserDistributions(address);
      setDistributions(data);
      setInitialLoad(false);
    } catch (err: unknown) {
      const error = err as APIError;
      setError(error.response?.data?.error?.message || 'Failed to fetch user distributions');
      setInitialLoad(false);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchUserDistributions();
  }, [fetchUserDistributions]);

  return {
    distributions,
    loading,
    initialLoad,
    error,
    refetch: fetchUserDistributions,
  };
}

/**
 * Hook for creating distributions
 */
export function useCreateDistribution() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAllocations = async (allocations: Allocation[]) => {
    try {
      const result = await merkleAPI.validateAllocations(allocations);
      return result;
    } catch (err: unknown) {
      const error = err as APIError;
      throw new Error(error.response?.data?.error?.message || 'Validation failed');
    }
  };

  const createDistribution = async (request: CreateDistributionRequest) => {
    try {
      setLoading(true);
      setError(null);
      const result = await merkleAPI.createDistribution(request);
      return result;
    } catch (err: unknown) {
      const error = err as APIError;
      const errorMsg = error.response?.data?.error?.message || 'Failed to create distribution';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    validateAllocations,
    createDistribution,
    loading,
    error,
  };
}

/**
 * Hook to check eligibility for a distribution
 */
export function useDistributionEligibility(distributionId: number | null) {
  const { address } = useAccount();
  const [eligibility, setEligibility] = useState<DistributionEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEligibility = useCallback(async () => {
    if (!distributionId || !address) {
      setEligibility(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await merkleAPI.checkEligibility(distributionId, address);
      setEligibility(data);
    } catch (err: unknown) {
      const error = err as APIError;
      setError(error.response?.data?.error?.message || 'Failed to check eligibility');
    } finally {
      setLoading(false);
    }
  }, [distributionId, address]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  return {
    eligibility,
    loading,
    error,
    refetch: checkEligibility,
  };
}

/**
 * Hook to get Merkle proof for claiming
 */
export function useMerkleProof(distributionId: number | null) {
  const { address } = useAccount();
  const [proof, setProof] = useState<MerkleProof | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProof = useCallback(async () => {
    if (!distributionId || !address) {
      setProof(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await merkleAPI.getProof(distributionId, address);
      setProof(data);
    } catch (err: unknown) {
      const error = err as APIError;
      setError(error.response?.data?.error?.message || 'Failed to get proof');
    } finally {
      setLoading(false);
    }
  }, [distributionId, address]);

  return {
    proof,
    loading,
    error,
    getProof,
  };
}

/**
 * Hook for admin operations
 */
export function useMerkleAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncDistribution = async (distributionId: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await merkleAPI.syncDistribution(distributionId);
      return result;
    } catch (err: unknown) {
      const error = err as APIError;
      const errorMsg = error.response?.data?.error?.message || 'Failed to sync distribution';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getDistributionLeaves = async (distributionId: number): Promise<MerkleLeaf[]> => {
    try {
      setLoading(true);
      setError(null);
      const result = await merkleAPI.getDistributionLeaves(distributionId);
      return result;
    } catch (err: unknown) {
      const error = err as APIError;
      const errorMsg = error.response?.data?.error?.message || 'Failed to get distribution leaves';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    syncDistribution,
    getDistributionLeaves,
    loading,
    error,
  };
}
