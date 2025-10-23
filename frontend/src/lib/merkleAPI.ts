/**
 * Merkle Distribution API Client
 * Client for interacting with Merkle distribution endpoints
 */

import axios, { AxiosInstance } from 'axios';
import type {
  Allocation,
  CreateDistributionRequest,
  CreateDistributionResponse,
  DistributionFilters,
  DistributionListResponse,
  MerkleDistribution,
  MerkleProof,
  DistributionEligibility,
  ValidationResult,
  MerkleLeaf,
} from '@/types/merkle';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const MERKLE_BASE_URL = `${API_BASE_URL}/api/merkle`;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

class MerkleAPIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: MERKLE_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'X-API-Key': API_KEY }),
      },
    });
  }

  /**
   * Validate allocations before creating distribution
   */
  async validateAllocations(allocations: Allocation[]): Promise<ValidationResult> {
    const response = await this.client.post('/validate-allocations', { allocations });
    return response.data.data;
  }

  /**
   * Create a new Merkle distribution
   */
  async createDistribution(
    request: CreateDistributionRequest
  ): Promise<CreateDistributionResponse> {
    const response = await this.client.post('/distributions/create', request);
    return response.data.data;
  }

  /**
   * Get all distributions with optional filters
   */
  async getDistributions(filters?: DistributionFilters): Promise<DistributionListResponse> {
    const response = await this.client.get('/distributions', { params: filters });
    return response.data.data;
  }

  /**
   * Get a specific distribution by ID
   */
  async getDistribution(distributionId: number): Promise<MerkleDistribution> {
    const response = await this.client.get(`/distributions/${distributionId}`);
    return response.data.data.distribution;
  }

  /**
   * Get distributions for a specific user address
   */
  async getUserDistributions(address: string): Promise<MerkleDistribution[]> {
    const response = await this.client.get(`/users/${address}/distributions`);
    return response.data.data.distributions;
  }

  /**
   * Check if an address is eligible for a distribution
   */
  async checkEligibility(
    distributionId: number,
    address: string
  ): Promise<DistributionEligibility> {
    const response = await this.client.get(`/distributions/${distributionId}/eligible/${address}`);
    return response.data.data;
  }

  /**
   * Get Merkle proof for an address
   */
  async getProof(distributionId: number, address: string): Promise<MerkleProof> {
    const response = await this.client.get(`/distributions/${distributionId}/proof/${address}`);
    return response.data.data.proof;
  }

  /**
   * Sync distribution data from blockchain (Admin only)
   */
  async syncDistribution(distributionId: number): Promise<MerkleDistribution> {
    const response = await this.client.post(`/distributions/${distributionId}/sync`);
    return response.data.data.distribution;
  }

  /**
   * Get all leaves of a distribution (Admin only)
   */
  async getDistributionLeaves(distributionId: number): Promise<MerkleLeaf[]> {
    const response = await this.client.get(`/distributions/${distributionId}/leaves`);
    return response.data.data.leaves;
  }
}

// Export singleton instance
export const merkleAPI = new MerkleAPIClient();
