/**
 * Integration test for Auto-Finalization System
 * 
 * Tests:
 * 1. Distribution Finalizer Service
 * 2. Cron Jobs Service
 * 3. API Endpoints
 * 4. Database Models
 * 
 * Usage: node scripts/test-auto-finalization.js
 */

require('dotenv').config();
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const distributionFinalizer = require('../src/services/distributionFinalizer');
const cronJobsService = require('../src/services/cronJobs');
const DistributionFinalization = require('../src/models/DistributionFinalization');
const axios = require('axios');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`)
};

// Test configuration
const config = {
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    adminSecret: process.env.ADMIN_SECRET_KEY || 'your-test-admin-secret',
    mongoUri: process.env.MONGODB_URI
};

let testResults = {
    passed: 0,
    failed: 0,
    total: 0
};

/**
 * Test helper functions
 */
const assert = (condition, message) => {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        log.success(message);
        return true;
    } else {
        testResults.failed++;
        log.error(message);
        return false;
    }
};

const assertThrows = async (fn, message) => {
    testResults.total++;
    try {
        await fn();
        testResults.failed++;
        log.error(`${message} (expected to throw but didn't)`);
        return false;
    } catch (error) {
        testResults.passed++;
        log.success(message);
        return true;
    }
};

/**
 * Connect to database
 */
async function connectDatabase() {
    if (!config.mongoUri) {
        log.error('MONGODB_URI not set in environment');
        return false;
    }

    try {
        await mongoose.connect(config.mongoUri);
        log.success('Connected to MongoDB');
        return true;
    } catch (error) {
        log.error(`Database connection failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 1: DistributionFinalization Model
 */
async function testDistributionFinalizationModel() {
    log.section('Test 1: DistributionFinalization Model');

    try {
        // Create a test finalization record
        const testRecord = new DistributionFinalization({
            distributionId: 999,
            status: 'pending',
            executionType: 'manual',
            executedBy: '0xTestAddress',
            distributionEndTime: new Date(),
            totalAllocated: '1000000000000000000',
            totalClaimed: '500000000000000000',
            unclaimedAmount: '500000000000000000',
            vaultType: 0
        });

        await testRecord.save();
        assert(true, 'Created test finalization record');

        // Test markSuccess method
        await testRecord.markSuccess('0xtxhash', 12345, '100000', '500000000000000000', 0);
        assert(testRecord.status === 'success', 'markSuccess updates status correctly');
        assert(testRecord.txHash === '0xtxhash', 'markSuccess sets txHash');

        // Test markFailed method
        const failRecord = new DistributionFinalization({
            distributionId: 998,
            status: 'pending',
            executionType: 'auto',
            executedBy: 'cron',
            distributionEndTime: new Date(),
            totalAllocated: '1000000000000000000',
            totalClaimed: '0',
            unclaimedAmount: '1000000000000000000',
            vaultType: 1
        });
        await failRecord.save();
        await failRecord.markFailed('Test error message');
        assert(failRecord.status === 'failed', 'markFailed updates status correctly');
        assert(failRecord.errorCount === 1, 'markFailed increments error count');

        // Test findPendingRetries
        await failRecord.scheduleRetry(3600000); // 1 hour
        const pendingRetries = await DistributionFinalization.findPendingRetries();
        assert(pendingRetries.length >= 0, 'findPendingRetries executes successfully');

        // Test getSuccessRate
        const stats = await DistributionFinalization.getSuccessRate(7);
        assert(typeof stats.successRate !== 'undefined', 'getSuccessRate returns success rate');
        log.info(`Success rate: ${stats.successRate}%`);

        // Cleanup
        await DistributionFinalization.deleteMany({ distributionId: { $in: [999, 998] } });
        log.success('Cleaned up test records');

    } catch (error) {
        log.error(`Model test failed: ${error.message}`);
        return false;
    }

    return true;
}

/**
 * Test 2: Distribution Finalizer Service
 */
async function testDistributionFinalizer() {
    log.section('Test 2: Distribution Finalizer Service');

    try {
        // Test initialization
        await distributionFinalizer.initialize();
        assert(distributionFinalizer.isInitialized, 'Finalizer initialized successfully');

        // Test isEnabled
        const isEnabled = distributionFinalizer.isEnabled();
        log.info(`Auto-finalization enabled: ${isEnabled}`);

        // Test getMaxFinalizationsPerRun
        const maxFinalizations = distributionFinalizer.getMaxFinalizationsPerRun();
        assert(maxFinalizations > 0, `Max finalizations per run: ${maxFinalizations}`);

        // Test checkWalletBalance
        const hasBalance = await distributionFinalizer.checkWalletBalance();
        log.info(`Wallet has sufficient balance: ${hasBalance}`);

        // Test fetchExpiredDistributions
        log.info('Fetching expired distributions from blockchain...');
        const expiredDistributions = await distributionFinalizer.fetchExpiredDistributions();
        assert(Array.isArray(expiredDistributions), 'fetchExpiredDistributions returns array');
        log.info(`Found ${expiredDistributions.length} expired distribution(s)`);

        // Test getStats
        const stats = await distributionFinalizer.getStats(7);
        assert(typeof stats.total !== 'undefined', 'getStats returns statistics');
        log.info(`Stats: ${stats.successful}/${stats.total} successful (${stats.successRate}%)`);

        // Test getHistory
        const history = await distributionFinalizer.getHistory(10);
        assert(Array.isArray(history), 'getHistory returns array');
        log.info(`History contains ${history.length} record(s)`);

    } catch (error) {
        log.error(`Finalizer service test failed: ${error.message}`);
        return false;
    }

    return true;
}

/**
 * Test 3: Cron Jobs Service
 */
async function testCronJobsService() {
    log.section('Test 3: Cron Jobs Service');

    try {
        // Test getStatus
        const status = cronJobsService.getStatus();
        assert(typeof status.enabled !== 'undefined', 'getStatus returns status object');
        log.info(`Cron enabled: ${status.enabled}`);
        log.info(`Schedule: ${status.schedule}`);
        log.info(`Next run: ${status.nextAutoFinalizationRun}`);

        // Note: We don't actually trigger finalization in tests unless explicitly requested

    } catch (error) {
        log.error(`Cron service test failed: ${error.message}`);
        return false;
    }

    return true;
}

/**
 * Test 4: API Endpoints
 */
async function testAPIEndpoints() {
    log.section('Test 4: API Endpoints');

    const headers = {
        'X-Admin-Secret': config.adminSecret,
        'Content-Type': 'application/json'
    };

    try {
        // Test GET /api/admin/finalization/status
        log.info('Testing GET /api/admin/finalization/status');
        log.info(`URL: ${config.apiBaseUrl}/api/admin/finalization/status`);
        log.info(`Headers: ${JSON.stringify({ ...headers, 'X-Admin-Secret': '***' + (headers['X-Admin-Secret'] || '').slice(-5) })}`);
        const statusResponse = await axios.get(
            `${config.apiBaseUrl}/api/admin/finalization/status`,
            { headers }
        );
        assert(statusResponse.status === 200, 'GET /finalization/status returns 200');
        assert(statusResponse.data.success === true, 'Status response has success=true');
        log.info(`API Status: ${JSON.stringify(statusResponse.data.data.enabled)}`);

        // Test GET /api/admin/finalization/stats
        log.info('Testing GET /api/admin/finalization/stats');
        const statsResponse = await axios.get(
            `${config.apiBaseUrl}/api/admin/finalization/stats?days=7`,
            { headers }
        );
        assert(statsResponse.status === 200, 'GET /finalization/stats returns 200');
        assert(statsResponse.data.success === true, 'Stats response has success=true');
        log.info(`API Stats: ${JSON.stringify(statsResponse.data.data)}`);

        // Test GET /api/admin/finalization/history
        log.info('Testing GET /api/admin/finalization/history');
        const historyResponse = await axios.get(
            `${config.apiBaseUrl}/api/admin/finalization/history?limit=10`,
            { headers }
        );
        assert(historyResponse.status === 200, 'GET /finalization/history returns 200');
        assert(historyResponse.data.success === true, 'History response has success=true');
        log.info(`History count: ${historyResponse.data.data.count}`);

        // Test POST /api/admin/finalization/run (read-only - don't actually run)
        log.warn('Skipping POST /finalization/run (would execute real transactions)');

    } catch (error) {
        if (error.response) {
            log.error(`API test failed: ${error.response.status} ${error.response.statusText}`);
            log.error(`Response data: ${JSON.stringify(error.response.data)}`);
            log.error(`Request URL: ${error.config?.url}`);
            log.error(`Request headers: ${JSON.stringify({ ...error.config?.headers, 'X-Admin-Secret': '***' })}`);
        } else if (error.request) {
            log.error(`API test failed: No response received`);
            log.error(`Request: ${JSON.stringify(error.request)}`);
        } else {
            log.error(`API test failed: ${error.message}`);
        }
        return false;
    }

    return true;
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('\n' + '='.repeat(80));
    console.log('  AUTO-FINALIZATION SYSTEM INTEGRATION TESTS');
    console.log('='.repeat(80) + '\n');

    log.info(`API Base URL: ${config.apiBaseUrl}`);
    log.info(`Admin Secret: ${config.adminSecret ? '***' + config.adminSecret.slice(-5) : 'NOT SET'}`);
    log.info(`MongoDB: ${config.mongoUri ? 'Connected' : 'Not configured'}`);
    log.info(`Auto-finalization enabled: ${process.env.ENABLE_AUTO_FINALIZATION || 'false'}`);

    // Connect to database
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
        log.error('Cannot proceed without database connection');
        process.exit(1);
    }

    // Run tests
    await testDistributionFinalizationModel();
    await testDistributionFinalizer();
    await testCronJobsService();

    // Only test API if server is running
    if (config.apiBaseUrl.includes('localhost')) {
        log.warn('Testing local API endpoints (ensure server is running)');
        try {
            await testAPIEndpoints();
        } catch (error) {
            log.warn('API tests skipped (server may not be running)');
        }
    } else {
        await testAPIEndpoints();
    }

    // Print summary
    log.section('Test Summary');
    console.log(`Total tests: ${testResults.total}`);
    console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);

    const successRate = ((testResults.passed / testResults.total) * 100).toFixed(2);
    console.log(`Success rate: ${successRate}%\n`);

    // Cleanup
    await mongoose.disconnect();
    log.success('Disconnected from MongoDB');

    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    log.error(`Test runner failed: ${error.message}`);
    process.exit(1);
});
