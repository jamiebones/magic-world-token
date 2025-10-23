const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

/**
 * MerkleTreeBuilder
 * Utility for building Merkle trees and generating proofs for token distributions
 * 
 * Compatible with Solidity's MerkleProof.verify() function
 */
class MerkleTreeBuilder {
  /**
   * Create a Merkle tree from an array of allocations
   * @param {Array} allocations - Array of {address, amount} objects
   * @returns {Object} { tree, root, leaves, leafMap }
   */
  static buildTree(allocations) {
    // Validate input
    if (!Array.isArray(allocations) || allocations.length === 0) {
      throw new Error('Allocations must be a non-empty array');
    }

    // Sort allocations by address for deterministic tree
    const sortedAllocations = [...allocations].sort((a, b) => 
      a.address.toLowerCase().localeCompare(b.address.toLowerCase())
    );

    // Generate leaves
    const leaves = sortedAllocations.map((allocation, index) => {
      const { address, amount } = allocation;
      
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid address at index ${index}: ${address}`);
      }

      // Validate amount
      const parsedAmount = ethers.parseEther(amount.toString());
      if (parsedAmount <= 0n) {
        throw new Error(`Invalid amount at index ${index}: ${amount}`);
      }

      // Create leaf hash: keccak256(abi.encodePacked(address, amount))
      // Must match Solidity: keccak256(abi.encodePacked(userAddress, totalAmount))
      const leaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [address, parsedAmount]
      );

      return {
        address: address.toLowerCase(),
        amount: parsedAmount.toString(),
        leafHash: leaf,
        leafIndex: index,
      };
    });

    // Create leaf map for quick lookup
    const leafMap = new Map();
    leaves.forEach(leaf => {
      leafMap.set(leaf.address.toLowerCase(), leaf);
    });

    // Build Merkle tree
    const leafHashes = leaves.map(l => l.leafHash);
    const tree = new MerkleTree(leafHashes, keccak256, { 
      sortPairs: true, // Sort pairs for consistency with Solidity
      hashLeaves: false, // Leaves are already hashed
    });

    const root = tree.getHexRoot();

    return {
      tree,
      root,
      leaves,
      leafMap,
      totalAllocated: leaves.reduce((sum, leaf) => sum + BigInt(leaf.amount), 0n).toString(),
    };
  }

  /**
   * Generate Merkle proof for a specific address
   * @param {MerkleTree} tree - Merkle tree instance
   * @param {string} address - User address
   * @param {Map} leafMap - Map of address to leaf data
   * @returns {Array} Merkle proof (array of hex strings)
   */
  static getProof(tree, address, leafMap) {
    const leaf = leafMap.get(address.toLowerCase());
    
    if (!leaf) {
      throw new Error(`Address not found in tree: ${address}`);
    }

    const proof = tree.getHexProof(leaf.leafHash);
    return proof;
  }

  /**
   * Verify a Merkle proof
   * @param {Array} proof - Merkle proof
   * @param {string} root - Merkle root
   * @param {string} address - User address
   * @param {string} amount - Allocated amount (in wei)
   * @returns {boolean} True if proof is valid
   */
  static verifyProof(proof, root, address, amount) {
    // Create leaf hash
    const leaf = ethers.solidityPackedKeccak256(
      ['address', 'uint256'],
      [address, amount]
    );

    // Verify proof
    const verified = MerkleTree.verify(proof, leaf, root, keccak256, {
      sortPairs: true,
    });

    return verified;
  }

  /**
   * Parse CSV data into allocations array
   * @param {string} csvData - CSV string with format: address,amount
   * @returns {Array} Array of {address, amount} objects
   */
  static parseCSV(csvData) {
    const lines = csvData.trim().split('\n');
    const allocations = [];

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('address') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [address, amount] = line.split(',').map(s => s.trim());
      
      if (!address || !amount) {
        throw new Error(`Invalid CSV format at line ${i + 1}: ${line}`);
      }

      allocations.push({ address, amount });
    }

    return allocations;
  }

  /**
   * Parse JSON data into allocations array
   * @param {string|Array} jsonData - JSON string or array
   * @returns {Array} Array of {address, amount} objects
   */
  static parseJSON(jsonData) {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

    if (!Array.isArray(data)) {
      throw new Error('JSON data must be an array');
    }

    return data.map((item, index) => {
      if (!item.address || !item.amount) {
        throw new Error(`Invalid allocation at index ${index}: missing address or amount`);
      }
      return {
        address: item.address,
        amount: item.amount,
      };
    });
  }

  /**
   * Validate allocations array
   * @param {Array} allocations - Array of {address, amount} objects
   * @returns {Object} { valid: boolean, errors: Array, totalAmount: string }
   */
  static validateAllocations(allocations) {
    const errors = [];
    let totalAmount = 0n;
    const addresses = new Set();

    allocations.forEach((allocation, index) => {
      const { address, amount } = allocation;

      // Check for required fields
      if (!address) {
        errors.push(`Missing address at index ${index}`);
        return;
      }

      if (!amount && amount !== 0) {
        errors.push(`Missing amount at index ${index}`);
        return;
      }

      // Validate address
      if (!ethers.isAddress(address)) {
        errors.push(`Invalid address at index ${index}: ${address}`);
      }

      // Check for duplicates
      const lowerAddress = address.toLowerCase();
      if (addresses.has(lowerAddress)) {
        errors.push(`Duplicate address at index ${index}: ${address}`);
      }
      addresses.add(lowerAddress);

      // Validate amount
      try {
        const parsedAmount = ethers.parseEther(amount.toString());
        if (parsedAmount <= 0n) {
          errors.push(`Invalid amount at index ${index}: ${amount} (must be positive)`);
        } else {
          totalAmount += parsedAmount;
        }
      } catch (err) {
        errors.push(`Invalid amount format at index ${index}: ${amount}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      totalAmount: totalAmount.toString(),
      recipientCount: addresses.size,
    };
  }

  /**
   * Get tree statistics
   * @param {Object} treeData - Result from buildTree()
   * @returns {Object} Statistics about the tree
   */
  static getTreeStats(treeData) {
    const { leaves, root, totalAllocated } = treeData;
    
    return {
      recipientCount: leaves.length,
      totalAllocated,
      merkleRoot: root,
      treeDepth: Math.ceil(Math.log2(leaves.length)),
      averageAllocation: (BigInt(totalAllocated) / BigInt(leaves.length)).toString(),
      minAllocation: leaves.reduce((min, leaf) => 
        BigInt(leaf.amount) < BigInt(min) ? leaf.amount : min, 
        leaves[0].amount
      ),
      maxAllocation: leaves.reduce((max, leaf) => 
        BigInt(leaf.amount) > BigInt(max) ? leaf.amount : max, 
        leaves[0].amount
      ),
    };
  }
}

module.exports = MerkleTreeBuilder;
