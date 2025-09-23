const express = require('express');
const blockchainService = require('../services/blockchain');
const databaseService = require('../services/database');
const { getApiKeyStats } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req, res) => {
    const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services: {}
    };

    try {
        // Check database connection
        const dbHealth = await databaseService.healthCheck();
        healthCheck.services.database = dbHealth;

        // Check blockchain connection
        if (blockchainService.isInitialized) {
            healthCheck.services.blockchain = {
                status: 'connected',
                network: process.env.BLOCKCHAIN_NETWORK
            };
        } else {
            healthCheck.services.blockchain = {
                status: 'disconnected',
                error: 'Blockchain service not initialized'
            };
            healthCheck.status = 'degraded';
        }

        // Check API key system
        const apiKeyCount = (await getApiKeyStats()).length;
        healthCheck.services.authentication = {
            status: 'active',
            activeKeys: apiKeyCount
        };

        // Add memory usage
        const memUsage = process.memoryUsage();
        healthCheck.memory = {
            used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
        };

        // Determine overall status
        const allServicesHealthy = Object.values(healthCheck.services)
            .every(service => service.status === 'connected' || service.status === 'active' || service.status === 'healthy');

        if (!allServicesHealthy) {
            healthCheck.status = 'unhealthy';
            return res.status(503).json(healthCheck);
        }

        res.json(healthCheck);

    } catch (error) {
        healthCheck.status = 'unhealthy';
        healthCheck.error = error.message;
        res.status(503).json(healthCheck);
    }
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with contract verification
 *     tags: [Health]
 */
router.get('/detailed', async (req, res) => {
    const detailedHealth = {
        status: 'checking',
        timestamp: new Date().toISOString(),
        services: {}
    };

    try {
        // Check database health
        const dbHealth = await databaseService.healthCheck();
        detailedHealth.services.database = dbHealth;

        // Test blockchain connection with actual contract call
        if (blockchainService.isInitialized) {
            try {
                const stats = await blockchainService.getContractStats();
                detailedHealth.services.blockchain = {
                    status: 'operational',
                    network: process.env.BLOCKCHAIN_NETWORK,
                    contracts: {
                        token: process.env.TOKEN_CONTRACT_ADDRESS,
                        game: process.env.GAME_CONTRACT_ADDRESS
                    },
                    contractBalance: stats.contractBalance
                };
            } catch (error) {
                detailedHealth.services.blockchain = {
                    status: 'error',
                    error: error.message
                };
            }
        } else {
            detailedHealth.services.blockchain = {
                status: 'disconnected',
                error: 'Not initialized'
            };
        }

        // Check environment configuration
        const requiredEnvVars = [
            'TOKEN_CONTRACT_ADDRESS',
            'GAME_CONTRACT_ADDRESS',
            'PRIVATE_KEY',
            'RPC_URL',
            'MONGODB_URI'
        ];

        const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

        detailedHealth.services.configuration = {
            status: missingEnvVars.length === 0 ? 'valid' : 'incomplete',
            missing: missingEnvVars
        };

        // Overall status
        const hasErrors = Object.values(detailedHealth.services)
            .some(service => service.status === 'error' || service.status === 'incomplete' || service.status === 'unhealthy');

        detailedHealth.status = hasErrors ? 'unhealthy' : 'healthy';

        const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(detailedHealth);

    } catch (error) {
        detailedHealth.status = 'error';
        detailedHealth.error = error.message;
        res.status(503).json(detailedHealth);
    }
});

module.exports = router;