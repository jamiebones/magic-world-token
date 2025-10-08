const crypto = require('crypto');
const { ethers } = require('ethers');

/**
 * Encryption/Decryption utilities for wallet private keys
 */

const ALGORITHM = 'aes-256-cbc';

/**
 * Get encryption key from environment
 * CRITICAL: This must be a 32-byte (256-bit) key stored securely
 */
function getEncryptionKey() {
    const key = process.env.WALLET_ENCRYPTION_KEY;

    if (!key) {
        throw new Error('WALLET_ENCRYPTION_KEY not configured in environment');
    }

    // Ensure key is exactly 32 bytes
    if (key.length !== 64) { // 64 hex chars = 32 bytes
        throw new Error('WALLET_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }

    return Buffer.from(key, 'hex');
}

/**
 * Encrypt a private key
 * @param {string} privateKey - The private key to encrypt (with or without 0x prefix)
 * @returns {Object} - { encryptedData, iv }
 */
function encryptPrivateKey(privateKey) {
    try {
        const key = getEncryptionKey();

        // Remove 0x prefix if present
        const cleanPrivateKey = privateKey.startsWith('0x')
            ? privateKey.slice(2)
            : privateKey;

        // Generate random IV (Initialization Vector)
        const iv = crypto.randomBytes(16);

        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt
        let encrypted = cipher.update(cleanPrivateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encryptedData: encrypted,
            iv: iv.toString('hex')
        };
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypt a private key
 * @param {string} encryptedData - The encrypted private key
 * @param {string} ivHex - The initialization vector in hex
 * @returns {string} - The decrypted private key (with 0x prefix)
 */
function decryptPrivateKey(encryptedData, ivHex) {
    try {
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        // Decrypt
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Add 0x prefix
        return '0x' + decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

/**
 * Generate a new Ethereum wallet
 * @returns {Object} - { address, privateKey }
 */
function generateWallet() {
    try {
        // Create random wallet using ethers.js
        const wallet = ethers.Wallet.createRandom();

        return {
            address: wallet.address.toLowerCase(),
            privateKey: wallet.privateKey
        };
    } catch (error) {
        throw new Error(`Wallet generation failed: ${error.message}`);
    }
}

/**
 * Generate wallet and encrypt private key
 * @returns {Object} - { address, encryptedPrivateKey, iv }
 */
function generateEncryptedWallet() {
    try {
        const { address, privateKey } = generateWallet();
        const { encryptedData, iv } = encryptPrivateKey(privateKey);

        return {
            address,
            encryptedPrivateKey: encryptedData,
            iv
        };
    } catch (error) {
        throw new Error(`Encrypted wallet generation failed: ${error.message}`);
    }
}

/**
 * Validate Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean}
 */
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate private key format
 * @param {string} privateKey - Private key to validate
 * @returns {boolean}
 */
function isValidPrivateKey(privateKey) {
    const cleanKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
    return /^[a-fA-F0-9]{64}$/.test(cleanKey);
}

/**
 * Derive address from private key (for verification)
 * @param {string} privateKey - Private key (encrypted will be decrypted)
 * @returns {string} - Ethereum address
 */
function getAddressFromPrivateKey(privateKey) {
    try {
        const wallet = new ethers.Wallet(privateKey);
        return wallet.address.toLowerCase();
    } catch (error) {
        throw new Error(`Invalid private key: ${error.message}`);
    }
}

module.exports = {
    encryptPrivateKey,
    decryptPrivateKey,
    generateWallet,
    generateEncryptedWallet,
    isValidAddress,
    isValidPrivateKey,
    getAddressFromPrivateKey
};
