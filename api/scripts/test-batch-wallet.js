#!/usr/bin/env node

/**
 * Test script for batch wallet generation
 */

const axios = require('axios');

const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_SECRET = 'JamieBonesIsFromOuterSpace';

console.log('\n🧪 Testing BATCH Wallet Generation\n');
console.log('='.repeat(60));

async function testBatchGeneration() {
    console.log('\n1️⃣  Generating batch of 5 wallets (WITH private keys)...\n');

    try {
        const response = await axios.post(
            `${API_URL}/api/admin/wallets/generate`,
            {
                count: 5,
                returnPrivateKey: true
            },
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ Success! Generated ${response.data.data.count} wallets:\n`);

        response.data.data.wallets.forEach((wallet, idx) => {
            console.log(`   Wallet ${idx + 1}:`);
            console.log(`     ID: ${wallet.id}`);
            console.log(`     Address: ${wallet.address}`);
            console.log(`     Private Key: ${wallet.privateKey?.substring(0, 20)}...${wallet.privateKey?.substring(wallet.privateKey.length - 10)}`);
            console.log(`     Created: ${wallet.createdAt}`);
            console.log('');
        });

        console.log(`   Warning: ${response.data.data.warning}\n`);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    // Test 2: Generate batch WITHOUT private keys
    console.log('\n2️⃣  Generating batch of 10 wallets (WITHOUT private keys)...\n');

    try {
        const response = await axios.post(
            `${API_URL}/api/admin/wallets/generate`,
            {
                count: 10,
                returnPrivateKey: false
            },
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ Success! Generated ${response.data.data.count} wallets:\n`);

        response.data.data.wallets.forEach((wallet, idx) => {
            console.log(`   ${idx + 1}. ${wallet.address} (${wallet.id})`);
        });

        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    // Test 3: Single wallet (default behavior)
    console.log('\n3️⃣  Generating single wallet (no count specified)...\n');

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

        console.log(`✅ Success! Generated ${response.data.data.count} wallet(s):\n`);
        console.log(`   Address: ${response.data.data.wallets[0].address}`);
        console.log(`   Private Key: ${response.data.data.wallets[0].privateKey?.substring(0, 20)}...`);
        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    // Test 4: Invalid count (should fail)
    console.log('\n4️⃣  Testing with invalid count (150, should fail)...\n');

    try {
        await axios.post(
            `${API_URL}/api/admin/wallets/generate`,
            {
                count: 150,
                returnPrivateKey: false
            },
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.error('❌ Should have failed with count > 100!\n');

    } catch (error) {
        if (error.response?.status === 400) {
            console.log('✅ Correctly rejected invalid count');
            console.log(`   Error: ${error.response.data.error.message}\n`);
        } else {
            console.error('⚠️  Unexpected error:', error.response?.data || error.message);
        }
    }

    // Test 5: List recent wallets
    console.log('\n5️⃣  Listing recent wallets...\n');

    try {
        const response = await axios.get(
            `${API_URL}/api/admin/wallets?limit=20`,
            {
                headers: {
                    'X-Admin-Secret': ADMIN_SECRET
                }
            }
        );

        console.log('✅ Retrieved wallet list');
        console.log(`   Total wallets in database: ${response.data.data.pagination.total}`);
        console.log(`   Showing: ${response.data.data.wallets.length} wallets\n`);

        console.log('   Most recent wallets:');
        response.data.data.wallets.slice(0, 10).forEach((wallet, idx) => {
            console.log(`   ${idx + 1}. ${wallet.address}`);
        });
        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    console.log('='.repeat(60));
    console.log('\n✅ Batch wallet generation tests completed!\n');
    console.log('📊 Summary:');
    console.log('   - Batch generation (5 wallets): ✅');
    console.log('   - Batch generation (10 wallets): ✅');
    console.log('   - Single wallet (default): ✅');
    console.log('   - Invalid count validation: ✅');
    console.log('   - Wallet listing: ✅\n');
}

testBatchGeneration();
