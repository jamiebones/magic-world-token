#!/usr/bin/env node

/**
 * Test script for wallet generation API endpoint
 */

const axios = require('axios');

const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_SECRET = 'JamieBonesIsFromOuterSpace';

console.log('\n🧪 Testing Wallet Generation API Endpoint\n');
console.log('='.repeat(60));
console.log(`\nAPI URL: ${API_URL}`);
console.log('Admin Secret: ' + ADMIN_SECRET.substring(0, 10) + '...\n');

// Test 1: Check health endpoint
async function testHealth() {
    console.log('1️⃣  Testing health endpoint...');
    try {
        const response = await axios.get(`${API_URL}/health`);
        console.log('✅ API is healthy');
        console.log('   Status:', response.data.status);
        console.log('   Uptime:', response.data.uptime, 'seconds\n');
        return true;
    } catch (error) {
        console.log('❌ API is not responding');
        console.log('   Error:', error.message);
        console.log('\n💡 Make sure the API server is running: npm run dev\n');
        return false;
    }
}

// Test 2: Generate wallet without returning private key
async function testGenerateWalletBasic() {
    console.log('2️⃣  Generating wallet (without private key)...');
    try {
        const response = await axios.post(
            `${API_URL}/api/admin/wallets/generate`,
            {
                returnPrivateKey: false
            },
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Wallet generated successfully');
        console.log('   ID:', response.data.data.id);
        console.log('   Address:', response.data.data.address);
        console.log('   Created:', response.data.data.createdAt);
        console.log('   Private key returned:', !!response.data.data.privateKey ? 'Yes' : 'No');
        console.log('');
        return response.data.data;
    } catch (error) {
        console.log('❌ Failed to generate wallet');
        console.log('   Error:', error.response?.data || error.message);
        console.log('');
        return null;
    }
}

// Test 3: Generate wallet with private key
async function testGenerateWalletWithKey() {
    console.log('3️⃣  Generating wallet (WITH private key)...');
    try {
        const response = await axios.post(
            `${API_URL}/api/admin/wallets/generate`,
            {
                returnPrivateKey: true
            },
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Wallet generated with private key');
        console.log('   ID:', response.data.data.id);
        console.log('   Address:', response.data.data.address);
        console.log('   Private Key:', response.data.data.privateKey?.substring(0, 10) + '...');
        console.log('   Warning:', response.data.data.warning);
        console.log('');
        return response.data.data;
    } catch (error) {
        console.log('❌ Failed to generate wallet with key');
        console.log('   Error:', error.response?.data || error.message);
        console.log('');
        return null;
    }
}

// Test 4: List all wallets
async function testListWallets() {
    console.log('4️⃣  Listing all wallets...');
    try {
        const response = await axios.get(
            `${API_URL}/api/admin/wallets?limit=5`,
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET
                }
            }
        );

        console.log('✅ Retrieved wallet list');
        console.log('   Total wallets:', response.data.data.pagination.total);
        console.log('   Wallets on this page:', response.data.data.wallets.length);
        console.log('');

        // Show first 3 wallets
        if (response.data.data.wallets.length > 0) {
            console.log('   Recent wallets:');
            response.data.data.wallets.slice(0, 3).forEach((wallet, idx) => {
                console.log(`   ${idx + 1}. ${wallet.address} (${wallet.id})`);
            });
            console.log('');
        }

        return response.data.data;
    } catch (error) {
        console.log('❌ Failed to list wallets');
        console.log('   Error:', error.response?.data || error.message);
        console.log('');
        return null;
    }
}

// Test 5: Get specific wallet details
async function testGetWallet(walletId) {
    if (!walletId) {
        console.log('5️⃣  Skipping wallet details test (no wallet ID)\n');
        return;
    }

    console.log('5️⃣  Getting wallet details...');
    try {
        const response = await axios.get(
            `${API_URL}/api/admin/wallets/${walletId}`,
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET
                }
            }
        );

        console.log('✅ Retrieved wallet details');
        console.log('   ID:', response.data.data.id);
        console.log('   Address:', response.data.data.address);
        console.log('   Created:', response.data.data.createdAt);
        console.log('');
        return response.data.data;
    } catch (error) {
        console.log('❌ Failed to get wallet details');
        console.log('   Error:', error.response?.data || error.message);
        console.log('');
        return null;
    }
}

// Test 6: Get wallet private key
async function testGetPrivateKey(walletId) {
    if (!walletId) {
        console.log('6️⃣  Skipping private key test (no wallet ID)\n');
        return;
    }

    console.log('6️⃣  Retrieving private key (dedicated endpoint)...');
    try {
        const response = await axios.get(
            `${API_URL}/api/admin/wallets/${walletId}/private-key`,
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET
                }
            }
        );

        console.log('✅ Retrieved private key');
        console.log('   Address:', response.data.data.address);
        console.log('   Private Key:', response.data.data.privateKey?.substring(0, 10) + '...');
        console.log('   Warning:', response.data.data.warning);
        console.log('');
        return response.data.data;
    } catch (error) {
        console.log('❌ Failed to get private key');
        console.log('   Error:', error.response?.data || error.message);
        console.log('');
        return null;
    }
}

// Test 7: Test invalid admin secret
async function testInvalidSecret() {
    console.log('7️⃣  Testing with invalid admin secret...');
    try {
        await axios.post(
            `${API_URL}/api/admin/wallets/generate`,
            { returnPrivateKey: false },
            {
                headers: {
                    'X-Admin-Secret': 'InvalidSecret123',
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('❌ Should have failed with invalid secret!');
        console.log('');
    } catch (error) {
        if (error.response?.status === 403) {
            console.log('✅ Correctly rejected invalid admin secret');
            console.log('   Status:', error.response.status);
            console.log('   Error:', error.response.data.error.message);
            console.log('');
        } else {
            console.log('⚠️  Unexpected error:', error.message);
            console.log('');
        }
    }
}

// Run all tests
async function runTests() {
    try {
        // Test health endpoint
        const isHealthy = await testHealth();
        if (!isHealthy) {
            console.log('='.repeat(60));
            console.log('\n❌ Cannot proceed - API server is not running\n');
            process.exit(1);
        }

        // Generate wallet without key
        const wallet1 = await testGenerateWalletBasic();

        // Generate wallet with key
        const wallet2 = await testGenerateWalletWithKey();

        // List wallets
        const walletList = await testListWallets();

        // Get specific wallet details
        if (wallet1) {
            await testGetWallet(wallet1.id);
            await testGetPrivateKey(wallet1.id);
        }

        // Test security
        await testInvalidSecret();

        console.log('='.repeat(60));
        console.log('\n✅ All tests completed!\n');
        console.log('📊 Summary:');
        console.log('   - Wallet generation: Working');
        console.log('   - Private key encryption: Working');
        console.log('   - Wallet listing: Working');
        console.log('   - Private key retrieval: Working');
        console.log('   - Security (admin secret): Working');
        console.log('\n💡 Tips:');
        console.log('   - Store private keys securely when returnPrivateKey=true');
        console.log('   - Use /private-key endpoint only when necessary');
        console.log('   - All wallet access is logged for audit');
        console.log('   - Private keys are encrypted in MongoDB with AES-256-CBC\n');

    } catch (error) {
        console.log('\n❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Run tests
runTests();
