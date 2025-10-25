import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { parseEther, Address } from 'viem';
import { useWriteContract } from 'wagmi';
import { MagicWorldTokenABI } from '@/abis';
import { CONTRACT_ADDRESSES } from '@/config/contracts';

interface PermitSignature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  deadline: bigint;
}

export function usePermitOperations() {
  const { address, chain } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  /**
   * Generate a permit signature for gasless approval
   */
  const generatePermitSignature = async (
    spender: Address,
    value: string,
    nonce: bigint,
    deadline?: bigint
  ): Promise<PermitSignature | null> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!address || !chain) {
        throw new Error('Wallet not connected');
      }

      // Default deadline: 1 hour from now
      const permitDeadline = deadline || BigInt(Math.floor(Date.now() / 1000) + 3600);
      const amount = parseEther(value);

      // EIP-712 Domain
      const domain = {
        name: 'Magic World Gems',
        version: '1',
        chainId: chain.id,
        verifyingContract: CONTRACT_ADDRESSES.TOKEN,
      };

      // EIP-712 Types
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };

      // Message to sign
      const message = {
        owner: address,
        spender,
        value: amount,
        nonce,
        deadline: permitDeadline,
      };

      // Sign the typed data
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Permit',
        message,
      });

      // Split signature into v, r, s
      const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
      const v = parseInt(signature.slice(130, 132), 16);

      return {
        v,
        r,
        s,
        deadline: permitDeadline,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate permit signature');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Execute permit transaction (usually done by relayer or in same tx as transferFrom)
   */
  const executePermit = async (
    owner: Address,
    spender: Address,
    value: string,
    signature: PermitSignature
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const amount = parseEther(value);

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.TOKEN,
        abi: MagicWorldTokenABI,
        functionName: 'permit',
        args: [
          owner,
          spender,
          amount,
          signature.deadline,
          signature.v,
          signature.r,
          signature.s,
        ],
      });

      return hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permit execution failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Approve using traditional method (for comparison)
   */
  const approve = async (spender: Address, value: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const amount = parseEther(value);

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.TOKEN,
        abi: MagicWorldTokenABI,
        functionName: 'approve',
        args: [spender, amount],
      });

      return hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generatePermitSignature,
    executePermit,
    approve,
    isLoading,
    error,
  };
}
