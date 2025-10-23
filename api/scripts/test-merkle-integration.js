/**
 * Merkle Distribution API Integration Tests
 * Comprehensive test suite for Merkle distribution endpoints
 * Tests both public and admin endpoints with proper authentication
 */

const axios = require('axios');
const { ethers } = require('ethers');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const MERKLE_BASE_URL = `${API_BASE_URL}/api/merkle`;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.API_KEY;

if (!ADMIN_API_KEY) {
    console.error('❌ Error: ADMIN_API_KEY or API_KEY environment variable is required');
    console.error('   Set API_KEY in your .env file or pass it as an environment variable');
    console.error('   Example: ADMIN_API_KEY=mwt_xxx npm run test:merkle');
    process.exit(1);
}

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

let testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
};

// Test data storage
let testContext = {
    distributionId: null,
    testAddresses: [
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
    ],
    allocations: null,
    merkleRoot: null
};

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null, requireAuth = false) {
    try {
        const config = {
            method,
            url: `${MERKLE_BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json'
            },
            validateStatus: () => true // Don't throw on any status
        };

        if (requireAuth) {
            config.headers['X-API-Key'] = ADMIN_API_KEY;
        }

        if (data) {
            if (method === 'GET') {
                config.params = data;
            } else {
                config.data = data;
            }
        }

        const response = await axios(config);
        return {
            status: response.status,
            data: response.data,
            headers: response.headers
        };
    } catch (error) {
        return {
            status: error.response?.status || 500,
            data: { error: error.message },
            headers: {}
        };
    }
}

// Test runner
async function runTest(name, category, testFn) {
    try {
        console.log(`${colors.cyan}Testing: ${name}${colors.reset}`);
        const result = await testFn();

        if (result.status === 'passed') {
            console.log(`${colors.green}✅ PASSED${colors.reset}`);
            testResults.passed++;
        } else if (result.status === 'skipped') {
            console.log(`${colors.yellow}⏭️  SKIPPED - ${result.reason}${colors.reset}`);
            testResults.skipped++;
        } else {
            console.log(`${colors.red}❌ FAILED - ${result.reason}${colors.reset}`);
            testResults.failed++;
        }

        testResults.tests.push({
            name,
            category,
            ...result
        });

        console.log('');
    } catch (error) {
        console.log(`${colors.red}❌ FAILED - ${error.message}${colors.reset}\n`);
        testResults.failed++;
        testResults.tests.push({
            name,
            category,
            status: 'failed',
            reason: error.message
        });
    }
}

// ============================================================================
// VALIDATION TESTS
// ============================================================================

async function testValidateAllocations() {
    const allocations = [
        { address: testContext.testAddresses[0], amount: 100 },
        { address: testContext.testAddresses[1], amount: 200 },
        { address: testContext.testAddresses[2], amount: 150 }
    ];

    const response = await apiRequest('POST', '/validate-allocations', { allocations }, true);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (!response.data.data.valid) {
        return { status: 'failed', reason: 'Allocations marked as invalid' };
    }

    if (!response.data.data.stats) {
        return { status: 'failed', reason: 'Missing stats in response' };
    }

    // Store for later use
    testContext.allocations = allocations;

    return { status: 'passed', data: response.data.data.stats };
}

async function testValidateInvalidAllocations() {
    const invalidAllocations = [
        { address: 'invalid_address', amount: 100 },
        { address: testContext.testAddresses[0], amount: -50 }
    ];

    const response = await apiRequest('POST', '/validate-allocations', { allocations: invalidAllocations }, true);

    if (response.status !== 400) {
        return { status: 'failed', reason: `Expected 400 for invalid data, got ${response.status}` };
    }

    return { status: 'passed' };
}

async function testValidateWithoutAuth() {
    const response = await apiRequest('POST', '/validate-allocations', { allocations: testContext.allocations }, false);

    if (response.status !== 401 && response.status !== 403) {
        return { status: 'failed', reason: `Expected 401/403 without auth, got ${response.status}` };
    }

    return { status: 'passed' };
}

// ============================================================================
// DISTRIBUTION CREATION TESTS
// ============================================================================

async function testCreateDistribution() {
    const distributionData = {
        allocations: testContext.allocations,
        vaultType: 'PLAYER_TASKS',
        durationInDays: 30,
        title: 'Test Distribution - Integration Test',
        description: 'This is a test distribution created by integration tests',
        tags: ['test', 'integration'],
        category: 'testing'
    };

    const response = await apiRequest('POST', '/distributions/create', distributionData, true);

    if (response.status !== 201) {
        // If it fails due to insufficient balance, skip remaining tests
        if (response.data.error && response.data.error.message &&
            response.data.error.message.includes('Insufficient vault balance')) {
            return {
                status: 'skipped',
                reason: 'Insufficient vault balance - contract may not be initialized with tokens'
            };
        }
        return { status: 'failed', reason: `Expected 201, got ${response.status}: ${JSON.stringify(response.data)}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (!response.data.data.distribution) {
        return { status: 'failed', reason: 'Missing distribution in response' };
    }

    if (!response.data.data.transactionHash) {
        return { status: 'failed', reason: 'Missing transaction hash' };
    }

    // Store distribution ID for later tests
    testContext.distributionId = response.data.data.distribution.distributionId;
    testContext.merkleRoot = response.data.data.distribution.merkleRoot;

    return { status: 'passed', data: response.data.data };
}

async function testCreateDistributionWithInvalidVault() {
    const distributionData = {
        allocations: testContext.allocations,
        vaultType: 'INVALID_VAULT',
        durationInDays: 30,
        title: 'Invalid Vault Test'
    };

    const response = await apiRequest('POST', '/distributions/create', distributionData, true);

    if (response.status !== 400) {
        return { status: 'failed', reason: `Expected 400 for invalid vault, got ${response.status}` };
    }

    return { status: 'passed' };
}

async function testCreateDistributionWithoutAuth() {
    const distributionData = {
        allocations: testContext.allocations,
        vaultType: 'PLAYER_TASKS',
        durationInDays: 30,
        title: 'Unauthorized Test'
    };

    const response = await apiRequest('POST', '/distributions/create', distributionData, false);

    if (response.status !== 401 && response.status !== 403) {
        return { status: 'failed', reason: `Expected 401/403 without auth, got ${response.status}` };
    }

    return { status: 'passed' };
}

// ============================================================================
// PUBLIC QUERY TESTS
// ============================================================================

async function testListDistributions() {
    const response = await apiRequest('GET', '/distributions', {}, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (!Array.isArray(response.data.data.distributions)) {
        return { status: 'failed', reason: 'Distributions is not an array' };
    }

    return { status: 'passed', data: { count: response.data.data.count } };
}

async function testListDistributionsWithFilters() {
    const response = await apiRequest('GET', '/distributions', {
        status: 'active',
        vaultType: 'PLAYER_TASKS',
        limit: 10
    }, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    return { status: 'passed' };
}

async function testGetDistributionById() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available (distribution creation failed)' };
    }

    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}`, {}, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (!response.data.data.distribution) {
        return { status: 'failed', reason: 'Missing distribution data' };
    }

    if (!response.data.data.stats) {
        return { status: 'failed', reason: 'Missing stats data' };
    }

    return { status: 'passed', data: response.data.data.distribution };
}

async function testGetNonExistentDistribution() {
    const response = await apiRequest('GET', '/distributions/99999', {}, false);

    if (response.status !== 404) {
        return { status: 'failed', reason: `Expected 404 for non-existent distribution, got ${response.status}` };
    }

    return { status: 'passed' };
}

// ============================================================================
// ELIGIBILITY AND PROOF TESTS
// ============================================================================

async function testCheckEligibility() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const testAddress = testContext.testAddresses[0];
    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}/eligibility/${testAddress}`, {}, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (response.data.data.eligible !== true) {
        return { status: 'failed', reason: 'Address should be eligible but is not' };
    }

    return { status: 'passed', data: response.data.data };
}

async function testCheckEligibilityForNonEligibleAddress() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const randomAddress = ethers.Wallet.createRandom().address;
    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}/eligibility/${randomAddress}`, {}, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (response.data.data.eligible !== false) {
        return { status: 'failed', reason: 'Random address should not be eligible' };
    }

    return { status: 'passed' };
}

async function testCheckEligibilityWithInvalidAddress() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}/eligibility/invalid_address`, {}, false);

    if (response.status !== 400) {
        return { status: 'failed', reason: `Expected 400 for invalid address, got ${response.status}` };
    }

    return { status: 'passed' };
}

async function testGetProof() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const testAddress = testContext.testAddresses[0];
    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}/proof/${testAddress}`, {}, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (!response.data.data.eligible) {
        return { status: 'failed', reason: 'Address should be eligible' };
    }

    if (!Array.isArray(response.data.data.proof)) {
        return { status: 'failed', reason: 'Proof should be an array' };
    }

    if (!response.data.data.allocatedAmount) {
        return { status: 'failed', reason: 'Missing allocated amount' };
    }

    return { status: 'passed', data: { proofLength: response.data.data.proof.length } };
}

async function testGetProofForNonEligibleAddress() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const randomAddress = ethers.Wallet.createRandom().address;
    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}/proof/${randomAddress}`, {}, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (response.data.data.eligible !== false) {
        return { status: 'failed', reason: 'Random address should not be eligible' };
    }

    return { status: 'passed' };
}

// ============================================================================
// USER DISTRIBUTIONS TESTS
// ============================================================================

async function testGetUserDistributions() {
    const testAddress = testContext.testAddresses[0];
    const response = await apiRequest('GET', `/users/${testAddress}/distributions`, {}, false);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (!Array.isArray(response.data.data.distributions)) {
        return { status: 'failed', reason: 'Distributions should be an array' };
    }

    return { status: 'passed', data: { count: response.data.data.count } };
}

async function testGetUserDistributionsWithInvalidAddress() {
    const response = await apiRequest('GET', '/users/invalid_address/distributions', {}, false);

    if (response.status !== 400) {
        return { status: 'failed', reason: `Expected 400 for invalid address, got ${response.status}` };
    }

    return { status: 'passed' };
}

// ============================================================================
// ADMIN OPERATIONS TESTS
// ============================================================================

async function testSyncDistribution() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const response = await apiRequest('POST', `/distributions/${testContext.distributionId}/sync`, {}, true);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    return { status: 'passed' };
}

async function testSyncDistributionWithoutAuth() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const response = await apiRequest('POST', `/distributions/${testContext.distributionId}/sync`, {}, false);

    if (response.status !== 401 && response.status !== 403) {
        return { status: 'failed', reason: `Expected 401/403 without auth, got ${response.status}` };
    }

    return { status: 'passed' };
}

async function testGetDistributionLeaves() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}/leaves`, { page: 1, limit: 10 }, true);

    if (response.status !== 200) {
        return { status: 'failed', reason: `Expected 200, got ${response.status}` };
    }

    if (!response.data.success) {
        return { status: 'failed', reason: 'Response success is false' };
    }

    if (!Array.isArray(response.data.data.leaves)) {
        return { status: 'failed', reason: 'Leaves should be an array' };
    }

    if (!response.data.data.pagination) {
        return { status: 'failed', reason: 'Missing pagination data' };
    }

    return { status: 'passed', data: { leafCount: response.data.data.leaves.length } };
}

async function testGetDistributionLeavesWithoutAuth() {
    if (!testContext.distributionId) {
        return { status: 'skipped', reason: 'No distribution ID available' };
    }

    const response = await apiRequest('GET', `/distributions/${testContext.distributionId}/leaves`, {}, false);

    if (response.status !== 401 && response.status !== 403) {
        return { status: 'failed', reason: `Expected 401/403 without auth, got ${response.status}` };
    }

    return { status: 'passed' };
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
    console.log(`${colors.magenta}
╔════════════════════════════════════════════════════════════════╗
║     MERKLE DISTRIBUTION API - INTEGRATION TEST SUITE           ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

    console.log(`${colors.blue}API Base URL: ${API_BASE_URL}${colors.reset}`);
    console.log(`${colors.blue}API Key: ${ADMIN_API_KEY.substring(0, 10)}...${colors.reset}\n`);

    // Validation Tests
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}VALIDATION TESTS${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    await runTest('Validate valid allocations', 'Validation', testValidateAllocations);
    await runTest('Reject invalid allocations', 'Validation', testValidateInvalidAllocations);
    await runTest('Require auth for validation', 'Validation', testValidateWithoutAuth);

    // Distribution Creation Tests
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}DISTRIBUTION CREATION TESTS${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    await runTest('Create distribution', 'Creation', testCreateDistribution);
    await runTest('Reject invalid vault type', 'Creation', testCreateDistributionWithInvalidVault);
    await runTest('Require auth for creation', 'Creation', testCreateDistributionWithoutAuth);

    // Public Query Tests
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}PUBLIC QUERY TESTS${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    await runTest('List all distributions', 'Query', testListDistributions);
    await runTest('List distributions with filters', 'Query', testListDistributionsWithFilters);
    await runTest('Get distribution by ID', 'Query', testGetDistributionById);
    await runTest('Return 404 for non-existent distribution', 'Query', testGetNonExistentDistribution);

    // Eligibility and Proof Tests
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}ELIGIBILITY AND PROOF TESTS${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    await runTest('Check eligibility for eligible address', 'Eligibility', testCheckEligibility);
    await runTest('Check eligibility for non-eligible address', 'Eligibility', testCheckEligibilityForNonEligibleAddress);
    await runTest('Reject invalid address format', 'Eligibility', testCheckEligibilityWithInvalidAddress);
    await runTest('Get Merkle proof for eligible address', 'Proof', testGetProof);
    await runTest('Handle proof request for non-eligible address', 'Proof', testGetProofForNonEligibleAddress);

    // User Distributions Tests
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}USER DISTRIBUTIONS TESTS${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    await runTest('Get distributions for user', 'User', testGetUserDistributions);
    await runTest('Reject invalid address for user distributions', 'User', testGetUserDistributionsWithInvalidAddress);

    // Admin Operations Tests
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}ADMIN OPERATIONS TESTS${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    await runTest('Sync distribution from blockchain', 'Admin', testSyncDistribution);
    await runTest('Require auth for sync', 'Admin', testSyncDistributionWithoutAuth);
    await runTest('Get distribution leaves', 'Admin', testGetDistributionLeaves);
    await runTest('Require auth for leaves', 'Admin', testGetDistributionLeavesWithoutAuth);

    // Print Summary
    printSummary();
}

function printSummary() {
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}TEST SUMMARY${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const total = testResults.passed + testResults.failed + testResults.skipped;
    const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;

    console.log(`${colors.green}✅ Passed:  ${testResults.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed:  ${testResults.failed}${colors.reset}`);
    console.log(`${colors.yellow}⏭️  Skipped: ${testResults.skipped}${colors.reset}`);
    console.log(`${colors.blue}📊 Total:   ${total}${colors.reset}`);
    console.log(`${colors.cyan}📈 Pass Rate: ${passRate}%${colors.reset}\n`);

    if (testResults.failed > 0) {
        console.log(`${colors.red}Failed Tests:${colors.reset}`);
        testResults.tests
            .filter(t => t.status === 'failed')
            .forEach(t => {
                console.log(`  ${colors.red}• ${t.name}${colors.reset}`);
                console.log(`    ${t.reason}`);
            });
        console.log('');
    }

    if (testResults.skipped > 0) {
        console.log(`${colors.yellow}Skipped Tests:${colors.reset}`);
        testResults.tests
            .filter(t => t.status === 'skipped')
            .forEach(t => {
                console.log(`  ${colors.yellow}• ${t.name}${colors.reset}`);
                console.log(`    ${t.reason}`);
            });
        console.log('');
    }

    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
    console.error(`${colors.red}Fatal error running tests:${colors.reset}`, error);
    process.exit(1);
});
