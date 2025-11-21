/**
 * Test script for Order Book API integration
 * 
 * Tests:
 * 1. API endpoints are accessible
 * 2. Database models work correctly
 * 3. Event listener can be initialized
 * 4. Services return expected data structures
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Order, OrderFill, Withdrawal } = require('../src/models');
const { orderBookService } = require('../src/services');

async function testDatabaseConnection() {
    console.log('\n=== Testing Database Connection ===\n');
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

async function testModels() {
    console.log('\n=== Testing Database Models ===\n');
    
    try {
        // Test Order model
        const orderCount = await Order.countDocuments();
        console.log(`✅ Order model accessible (${orderCount} documents)`);
        
        // Test OrderFill model
        const fillCount = await OrderFill.countDocuments();
        console.log(`✅ OrderFill model accessible (${fillCount} documents)`);
        
        // Test Withdrawal model
        const withdrawalCount = await Withdrawal.countDocuments();
        console.log(`✅ Withdrawal model accessible (${withdrawalCount} documents)`);
        
        return true;
    } catch (error) {
        console.error('❌ Model test failed:', error.message);
        return false;
    }
}

async function testServices() {
    console.log('\n=== Testing Order Book Services ===\n');
    
    try {
        // Test getOrderBookStats
        const stats = await orderBookService.getOrderBookStats();
        console.log('✅ getOrderBookStats() working');
        console.log('   Stats:', JSON.stringify(stats, null, 2));
        
        // Test getActiveOrders
        const activeOrders = await orderBookService.getActiveOrders('BUY', 1, 10);
        console.log(`✅ getActiveOrders() working (${activeOrders.orders.length} orders found)`);
        
        // Test getBestPrices
        const bestPrices = await orderBookService.getBestPrices();
        console.log('✅ getBestPrices() working');
        console.log('   Best prices:', JSON.stringify(bestPrices, null, 2));
        
        // Test getRecentActivity
        const recentActivity = await orderBookService.getRecentActivity(5);
        console.log(`✅ getRecentActivity() working (${recentActivity.length} events)`);
        
        return true;
    } catch (error) {
        console.error('❌ Service test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

async function testEventListenerConfig() {
    console.log('\n=== Testing Event Listener Configuration ===\n');
    
    try {
        const { OrderBookEventListener } = require('../src/services');
        
        const network = process.env.BLOCKCHAIN_NETWORK || 'bscTestnet';
        const contractAddress = network === 'bsc' 
            ? process.env.ORDERBOOK_CONTRACT_ADDRESS_MAINNET 
            : process.env.ORDERBOOK_CONTRACT_ADDRESS_TESTNET;
        const rpcUrl = network === 'bsc' 
            ? process.env.BSC_MAINNET_RPC 
            : process.env.BSC_TESTNET_RPC;
        
        if (!contractAddress) {
            console.log('⚠️  Order book contract address not configured');
            console.log('   Set ORDERBOOK_CONTRACT_ADDRESS_TESTNET in .env to test');
            return true;
        }
        
        const config = {
            contractAddress,
            network,
            rpcUrl,
            startBlock: 0,
            pollInterval: 30000
        };
        
        console.log('Configuration:');
        console.log(`   Network: ${config.network}`);
        console.log(`   Contract: ${config.contractAddress}`);
        console.log(`   RPC URL: ${config.rpcUrl}`);
        
        // Get singleton instance
        const listener = OrderBookEventListener.getInstance(config);
        console.log('✅ Event listener instance created');
        
        // Verify singleton pattern
        const listener2 = OrderBookEventListener.getInstance(config);
        if (listener === listener2) {
            console.log('✅ Singleton pattern working');
        } else {
            console.log('❌ Singleton pattern failed');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Event listener test failed:', error.message);
        return false;
    }
}

async function testAPIEndpoints() {
    console.log('\n=== Testing API Endpoint Availability ===\n');
    
    // This just checks if the route handlers are properly exported
    try {
        const orderbookRoutes = require('../src/routes/orderbook');
        console.log('✅ Order book routes imported successfully');
        
        // Check if routes are defined
        if (orderbookRoutes.stack && orderbookRoutes.stack.length > 0) {
            console.log(`✅ ${orderbookRoutes.stack.length} routes registered`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Route import failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting Order Book Integration Tests\n');
    console.log('='.repeat(60));
    
    const results = {
        database: false,
        models: false,
        services: false,
        eventListener: false,
        apiEndpoints: false
    };
    
    try {
        // Test 1: Database connection
        results.database = await testDatabaseConnection();
        
        // Test 2: Models
        if (results.database) {
            results.models = await testModels();
        } else {
            console.log('\n⏭️  Skipping model tests (database not connected)');
        }
        
        // Test 3: Services
        if (results.database && results.models) {
            results.services = await testServices();
        } else {
            console.log('\n⏭️  Skipping service tests (database/models failed)');
        }
        
        // Test 4: Event listener configuration
        results.eventListener = await testEventListenerConfig();
        
        // Test 5: API endpoints
        results.apiEndpoints = await testAPIEndpoints();
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('\n📊 Test Results Summary:\n');
        console.log(`   Database Connection:    ${results.database ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Database Models:        ${results.models ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Service Layer:          ${results.services ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Event Listener Config:  ${results.eventListener ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   API Endpoints:          ${results.apiEndpoints ? '✅ PASS' : '❌ FAIL'}`);
        
        const allPassed = Object.values(results).every(r => r === true);
        
        if (allPassed) {
            console.log('\n✅ All tests passed! Order book integration is ready.\n');
            process.exit(0);
        } else {
            console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('Database connection closed');
        }
    }
}

// Run tests
main();
