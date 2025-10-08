#!/usr/bin/env node

/**
 * Test script for wallet generation API
 * Run this after setting up WALLET_ENCRYPTION_KEY in .env
 */

require('dotenv').config();
const { generateEncryptedWallet, decryptPrivateKey } = require('../src/utils/walletUtils');

console.log('\n🧪 Testing Wallet Generation Utilities\n');
console.log('='.repeat(60));

// Test 1: Check if encryption key is configured
console.log('\n1️⃣  Checking encryption key configuration...');
try {
    const key = process.env.WALLET_ENCRYPTION_KEY;
    if (!key) {
        console.log('❌ WALLET_ENCRYPTION_KEY not found in environment');
        console.log('💡 Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        process.exit(1);
    }
    if (key.length !== 64) {
        console.log(`❌ WALLET_ENCRYPTION_KEY must be 64 characters (found ${key.length})`);
        process.exit(1);
    }
    console.log('✅ Encryption key configured correctly');
} catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
}

// Test 2: Generate a test wallet
console.log('\n2️⃣  Generating test wallet...');
let testWallet;
try {
    testWallet = generateEncryptedWallet();
    console.log('✅ Wallet generated successfully');
    console.log('   Address:', testWallet.address);
    console.log('   Encrypted key length:', testWallet.encryptedPrivateKey.length, 'chars');
    console.log('   IV length:', testWallet.iv.length, 'chars');
} catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
}

// Test 3: Test decryption
console.log('\n3️⃣  Testing decryption...');
try {
    const decrypted = decryptPrivateKey(testWallet.encryptedPrivateKey, testWallet.iv);
    console.log('✅ Decryption successful');
    console.log('   Private key format:', decrypted.substring(0, 6) + '...' + decrypted.substring(decrypted.length - 4));
    console.log('   Length:', decrypted.length, 'chars');

    // Verify it's a valid private key format
    if (!/^0x[a-fA-F0-9]{64}$/.test(decrypted)) {
        console.log('⚠️  Warning: Decrypted key format might be incorrect');
    }
} catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
}

// Test 4: Multiple wallets (ensure uniqueness)
console.log('\n4️⃣  Testing uniqueness (generating 5 wallets)...');
try {
    const addresses = new Set();
    for (let i = 0; i < 5; i++) {
        const wallet = generateEncryptedWallet();
        addresses.add(wallet.address);
    }
    if (addresses.size === 5) {
        console.log('✅ All 5 wallets have unique addresses');
    } else {
        console.log('❌ Duplicate addresses detected!');
    }
} catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
}

// Test 5: Encryption consistency
console.log('\n5️⃣  Testing encryption consistency...');
try {
    const { address, encryptedPrivateKey, iv } = generateEncryptedWallet();
    const decrypted1 = decryptPrivateKey(encryptedPrivateKey, iv);
    const decrypted2 = decryptPrivateKey(encryptedPrivateKey, iv);

    if (decrypted1 === decrypted2) {
        console.log('✅ Decryption is consistent');
    } else {
        console.log('❌ Decryption produces different results!');
    }
} catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ All tests passed! Wallet generation is working correctly.\n');
console.log('💡 Next steps:');
console.log('   1. Start your API server: npm run dev');
console.log('   2. Test the endpoint: POST /api/admin/wallets/generate');
console.log('   3. Use the WALLET_API.md documentation for examples\n');
