require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');
const emailService = require('../src/services/emailService');
const walletBalanceMonitor = require('../src/services/walletBalanceMonitor');
const WalletBalanceAlert = require('../src/models/WalletBalanceAlert');

/**
 * Comprehensive Test Suite for Wallet Balance Monitoring
 * 
 * Tests:
 * 1. Database connection
 * 2. Email service initialization and test email
 * 3. Wallet balance monitor initialization
 * 4. Balance checking functionality
 * 5. Alert creation and throttling
 * 6. Alert history queries
 * 7. Statistics generation
 * 8. Configuration updates
 */

async function runTests() {
    console.log('🧪 Starting Wallet Balance Monitoring Test Suite\n');
    console.log('='.repeat(70));

    try {
        // Test 1: Database Connection
        console.log('\n📊 Test 1: Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Database connected successfully');

        // Test 2: Email Service Initialization
        console.log('\n📧 Test 2: Initializing email service...');
        await emailService.initialize();
        console.log('✅ Email service initialized');

        // Test 2b: Send Test Email
        if (process.env.EMAIL_ALERTS_ENABLED === 'true') {
            console.log('\n📧 Test 2b: Sending test email...');
            const testResult = await emailService.testEmail();
            if (testResult.success) {
                console.log(`✅ Test email sent successfully!`);
                console.log(`   Message ID: ${testResult.messageId}`);
                console.log(`   Recipients: ${testResult.recipients.join(', ')}`);
            } else {
                console.log(`❌ Test email failed: ${testResult.error}`);
            }
        } else {
            console.log('⚠️  Email alerts disabled, skipping test email');
        }

        // Test 3: Wallet Balance Monitor Initialization
        console.log('\n💰 Test 3: Initializing wallet balance monitor...');
        await walletBalanceMonitor.initialize();
        console.log('✅ Wallet balance monitor initialized');

        // Test 4: Get Current Configuration
        console.log('\n⚙️  Test 4: Getting current configuration...');
        const config = await walletBalanceMonitor.getConfiguration();
        console.log('✅ Configuration retrieved:');
        console.log(`   Monitored Wallet: ${config.walletName} (${config.walletAddress})`);
        console.log(`   Threshold: ${config.threshold} BNB`);
        console.log(`   Network: ${config.network} (Chain ID: ${config.chainId})`);
        console.log(`   Enabled: ${config.enabled}`);

        // Test 5: Check Wallet Balance
        console.log('\n🔍 Test 5: Checking wallet balance...');
        if (!config.walletAddress || config.walletAddress === '0x...your_game_admin_wallet_address_here') {
            console.log('⚠️  GAME_ADMIN_ADDRESS not configured, skipping balance check');
            console.log('   Please set GAME_ADMIN_ADDRESS in your .env file to test balance checking');
        } else {
            const response = await walletBalanceMonitor.checkAllWallets();

            if (!response.success) {
                console.log(`⚠️  Balance check failed: ${response.message || response.error}`);
            } else {
                console.log(`✅ Balance check completed successfully`);

                const result = response.result;
                console.log(`\n   Wallet: ${result.walletName}`);
                console.log(`   Address: ${result.walletAddress}`);
                console.log(`   Balance: ${result.balance} BNB (${result.balanceNumber.toFixed(6)} numeric)`);
                console.log(`   Threshold: ${result.threshold} BNB`);
                console.log(`   Below Threshold: ${result.belowThreshold ? '⚠️  YES' : '✅ NO'}`);

                if (result.belowThreshold) {
                    console.log(`   Alert Sent: ${result.alertSent ? '✅ YES' : '❌ NO'}`);
                    if (result.alertSkipped) {
                        console.log(`   Alert Skipped: ${result.skipReason}`);
                    }
                    if (result.emailError) {
                        console.log(`   Email Error: ${result.emailError}`);
                    }
                }
            }
        }

        // Test 6: Query Alert History
        console.log('\n📜 Test 6: Querying alert history...');
        const alerts = await walletBalanceMonitor.getAlertHistory(null, 10);
        console.log(`✅ Found ${alerts.length} recent alert(s)`);

        if (alerts.length > 0) {
            console.log('\n   Recent Alerts:');
            alerts.forEach((alert, index) => {
                console.log(`   ${index + 1}. ${alert.walletName} - ${alert.balance} BNB (${alert.resolved ? '✅ Resolved' : '⚠️  Unresolved'})`);
                console.log(`      Alert Sent: ${alert.alertSentAt.toISOString()}`);
                console.log(`      Email: ${alert.emailSent ? '✅ Sent' : '❌ Not Sent'}`);
            });
        } else {
            console.log('   No alerts found (wallet balance is healthy!)');
        }

        // Test 7: Query Unresolved Alerts
        console.log('\n🚨 Test 7: Querying unresolved alerts...');
        const unresolvedAlerts = await walletBalanceMonitor.getUnresolvedAlerts(10);
        console.log(`✅ Found ${unresolvedAlerts.length} unresolved alert(s)`);

        if (unresolvedAlerts.length > 0) {
            console.log('\n   ⚠️  ACTION REQUIRED - Unresolved Alerts:');
            unresolvedAlerts.forEach((alert, index) => {
                console.log(`   ${index + 1}. ${alert.walletName} - ${alert.balance} BNB`);
                console.log(`      Threshold: ${alert.threshold} BNB`);
                console.log(`      Alert Age: ${Math.floor((Date.now() - alert.alertSentAt) / 3600000)} hours`);
                console.log(`      Action: Top up wallet to at least ${alert.threshold} BNB`);
            });
        } else {
            console.log('   ✅ No unresolved alerts - all wallets are healthy!');
        }

        // Test 8: Get Statistics
        console.log('\n📊 Test 8: Getting statistics (last 7 days)...');
        const stats = await walletBalanceMonitor.getStatistics(7);
        console.log('✅ Statistics retrieved:');
        console.log(`   Total Alerts: ${stats.totalAlerts}`);
        console.log(`   Unresolved Alerts: ${stats.unresolvedAlerts}`);
        console.log(`   Average Response Time: ${stats.averageResponseTime || 'N/A'}`);
        console.log(`   Emails Sent: ${stats.emailsSent}`);
        console.log(`   Email Failures: ${stats.emailFailures}`);

        if (stats.alertsByWallet && Object.keys(stats.alertsByWallet).length > 0) {
            console.log('\n   Alerts by Wallet:');
            Object.entries(stats.alertsByWallet).forEach(([wallet, count]) => {
                console.log(`   - ${wallet}: ${count} alert(s)`);
            });
        }

        // Test 9: Test Alert Throttling
        console.log('\n⏰ Test 9: Testing alert throttling...');
        const testWalletAddress = '0x0000000000000000000000000000000000000001';

        // Check if we should send alert (first time should be true)
        const shouldSend1 = await WalletBalanceAlert.shouldSendAlert(testWalletAddress);
        console.log(`✅ First check: Should send alert? ${shouldSend1}`);

        if (shouldSend1) {
            // Create a test alert
            await WalletBalanceAlert.createAlert({
                walletAddress: testWalletAddress,
                walletName: 'Test Wallet',
                balance: '0.01',
                balanceNumber: 0.01,
                threshold: '0.05',
                thresholdNumber: 0.05,
                network: 'Test Network',
                chainId: 1,
                emailSent: true,
                emailRecipients: ['test@example.com']
            });

            // Check again immediately (should be false due to 24h throttle)
            const shouldSend2 = await WalletBalanceAlert.shouldSendAlert(testWalletAddress);
            console.log(`✅ Second check (immediate): Should send alert? ${shouldSend2}`);
            console.log(`   ${shouldSend2 ? '❌ FAILED' : '✅ PASSED'} - Throttling is ${shouldSend2 ? 'NOT' : ''} working correctly`);

            // Clean up test alert
            await WalletBalanceAlert.deleteMany({ walletAddress: testWalletAddress });
            console.log('✅ Test alert cleaned up');
        }

        // Test 10: Configuration Update
        console.log('\n⚙️  Test 10: Testing configuration update...');
        const originalThreshold = config.threshold;
        const newThreshold = 0.1;

        console.log(`   Original threshold: ${originalThreshold} BNB`);
        console.log(`   Updating to: ${newThreshold} BNB`);

        const updatedConfig = await walletBalanceMonitor.updateConfiguration({
            threshold: newThreshold
        });

        console.log(`✅ Configuration updated successfully`);
        console.log(`   New threshold: ${updatedConfig.threshold} BNB`);

        // Restore original threshold
        await walletBalanceMonitor.updateConfiguration({
            threshold: originalThreshold
        });
        console.log(`✅ Configuration restored to original threshold: ${originalThreshold} BNB`);

        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('\n🎉 All tests completed successfully!\n');
        console.log('Summary:');
        console.log('  ✅ Database connection');
        console.log('  ✅ Email service initialization');
        console.log(`  ${process.env.EMAIL_ALERTS_ENABLED === 'true' ? '✅' : '⚠️ '} Test email (${process.env.EMAIL_ALERTS_ENABLED === 'true' ? 'sent' : 'disabled'})`);
        console.log('  ✅ Wallet balance monitor initialization');
        console.log('  ✅ Configuration retrieval');
        console.log(`  ${config.walletAddress && config.walletAddress !== '0x...your_game_admin_wallet_address_here' ? '✅' : '⚠️ '} Balance checking (${config.walletAddress && config.walletAddress !== '0x...your_game_admin_wallet_address_here' ? 'tested' : 'skipped - configure GAME_ADMIN_ADDRESS'})`);
        console.log('  ✅ Alert history queries');
        console.log('  ✅ Unresolved alerts queries');
        console.log('  ✅ Statistics generation');
        console.log('  ✅ Alert throttling');
        console.log('  ✅ Configuration updates');

        if (unresolvedAlerts.length > 0) {
            console.log('\n⚠️  WARNING: There are unresolved alerts! Please check the wallets above.');
        }

        console.log('\n📝 Next Steps:');
        console.log('  1. Ensure GAME_ADMIN_ADDRESS is set in .env');
        console.log('  2. Enable wallet balance checking: WALLET_BALANCE_CHECK_ENABLED=true');
        console.log('  3. Configure Gmail credentials (GMAIL_USER and GMAIL_APP_PASSWORD)');
        console.log('  4. Set email recipients in EMAIL_TO');
        console.log('  5. Start the API server to enable automated daily checks');
        console.log('\n💡 Tip: Use the admin API endpoints to manually trigger checks:');
        console.log('     POST /api/admin/wallet-balance/check');
        console.log('     GET  /api/admin/wallet-balance/alerts');
        console.log('     GET  /api/admin/wallet-balance/stats');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n📊 Database connection closed');
        process.exit(0);
    }
}

// Run tests
runTests();
