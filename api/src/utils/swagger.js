const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Magic World Token API',
            version: '1.0.0',
            description: 'REST API for Magic World Token blockchain integration - enabling games to distribute tokens to players',
            contact: {
                name: 'Magic World Token Team',
                email: 'support@magicworldtoken.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
                description: process.env.API_BASE_URL ? 'Production server' : 'Development server'
            },
            ...(process.env.API_BASE_URL ? [{
                url: `http://localhost:${process.env.PORT || 3000}`,
                description: 'Local development server'
            }] : [])
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                    description: 'API key required for authentication. Contact admin to get an API key.'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'Error description'
                                },
                                code: {
                                    type: 'string',
                                    example: 'ERROR_CODE'
                                },
                                statusCode: {
                                    type: 'integer',
                                    example: 400
                                },
                                timestamp: {
                                    type: 'string',
                                    format: 'date-time'
                                }
                            }
                        }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        data: {
                            type: 'object',
                            description: 'Response data'
                        }
                    }
                },
                DistributionRequest: {
                    type: 'object',
                    required: ['recipients', 'amounts'],
                    properties: {
                        recipients: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'Array of player wallet addresses',
                            example: ['0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611', '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612']
                        },
                        amounts: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'Array of token amounts (in tokens, not wei)',
                            example: ['100', '50']
                        },
                        reason: {
                            type: 'string',
                            description: 'Reason for distribution (optional)',
                            example: 'Tournament Prize Distribution'
                        }
                    }
                },
                EqualDistributionRequest: {
                    type: 'object',
                    required: ['recipients', 'amount'],
                    properties: {
                        recipients: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'Array of player wallet addresses',
                            example: ['0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611', '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612']
                        },
                        amount: {
                            type: 'string',
                            description: 'Token amount per player (in tokens, not wei)',
                            example: '10'
                        },
                        reason: {
                            type: 'string',
                            description: 'Reason for distribution (optional)',
                            example: 'Daily Login Reward'
                        }
                    }
                },
                TransactionResult: {
                    type: 'object',
                    properties: {
                        txHash: { type: 'string', example: '0x1234...' },
                        blockNumber: { type: 'number', example: 12345678 },
                        status: { type: 'string', example: 'confirmed' },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                },
                PriceData: {
                    type: 'object',
                    properties: {
                        mwtBnb: {
                            type: 'object',
                            properties: {
                                price: { type: 'number', example: 1001.44, description: 'MWT tokens per 1 BNB' }
                            }
                        },
                        bnbUsd: {
                            type: 'object',
                            properties: {
                                price: { type: 'number', example: 1097.44, description: 'USD per 1 BNB' },
                                source: { type: 'string', example: 'chainlink', description: 'Price data source' }
                            }
                        },
                        btcUsd: {
                            type: 'object',
                            properties: {
                                price: { type: 'number', example: 107634.46, description: 'USD per 1 BTC' },
                                source: { type: 'string', example: 'chainlink' }
                            }
                        },
                        mwtUsd: {
                            type: 'object',
                            properties: {
                                price: { type: 'number', example: 0.0109, description: 'USD per 1 MWT token' }
                            }
                        },
                        mwtBtc: {
                            type: 'object',
                            properties: {
                                price: { type: 'number', example: 0.00000010, description: 'BTC per 1 MWT token' },
                                satoshis: { type: 'number', example: 10.18, description: 'Satoshis per 1 MWT token' }
                            }
                        },
                        liquidity: {
                            type: 'object',
                            properties: {
                                mwtReserve: { type: 'string', example: '5000000', description: 'MWT token reserve in pair' },
                                bnbReserve: { type: 'string', example: '4991.234', description: 'BNB reserve in pair' },
                                totalLiquidityUSD: { type: 'number', example: 10956789.12, description: 'Total liquidity in USD' }
                            }
                        },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                },
                DeviationData: {
                    type: 'object',
                    properties: {
                        usd: {
                            type: 'object',
                            properties: {
                                currentPrice: { type: 'number', example: 0.0109 },
                                targetPrice: { type: 'number', example: 0.01 },
                                deviationPercent: { type: 'number', example: 9.0 }
                            }
                        },
                        btc: {
                            type: 'object',
                            properties: {
                                currentSatoshis: { type: 'number', example: 10.18 },
                                targetSatoshis: { type: 'number', example: 9.29 },
                                deviationPercent: { type: 'number', example: 9.58 }
                            }
                        }
                    }
                },
                TradeRequest: {
                    type: 'object',
                    required: ['action', 'amount'],
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['BUY', 'SELL'],
                            description: 'Trade direction: BUY (BNB->MWT) or SELL (MWT->BNB)'
                        },
                        amount: {
                            type: 'string',
                            example: '0.1',
                            description: 'Amount to trade (BNB for BUY, MWT for SELL)'
                        },
                        minOutput: {
                            type: 'string',
                            example: '95.5',
                            description: 'Minimum acceptable output amount (optional, default: amount * 0.95)'
                        },
                        slippage: {
                            type: 'number',
                            example: 5,
                            description: 'Maximum slippage percentage (1-10, optional, default: from config based on urgency)'
                        },
                        urgency: {
                            type: 'string',
                            enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'],
                            description: 'Trade urgency level affecting gas price (optional, default: MEDIUM)'
                        }
                    }
                },
                TradeResult: {
                    type: 'object',
                    properties: {
                        trade: {
                            type: 'object',
                            properties: {
                                tradeId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                                txHash: { type: 'string', example: '0xabcd1234...' },
                                status: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED'], example: 'SUCCESS' },
                                action: { type: 'string', enum: ['BUY', 'SELL'], example: 'BUY' },
                                inputAmount: { type: 'string', example: '0.1' },
                                outputAmount: { type: 'string', example: '100.5' },
                                inputToken: { type: 'string', example: 'BNB' },
                                outputToken: { type: 'string', example: 'MWT' },
                                effectivePrice: { type: 'number', example: 1005.0 },
                                gasUsed: { type: 'string', example: '150000' },
                                gasPriceGwei: { type: 'string', example: '3.5' },
                                timestamp: { type: 'string', format: 'date-time' }
                            }
                        }
                    }
                },
                BotConfig: {
                    type: 'object',
                    properties: {
                        botId: { type: 'string', example: 'main_bot' },
                        enabled: { type: 'boolean', example: true },
                        targetPeg: { type: 'number', example: 0.01, description: 'Target USD price' },
                        thresholds: {
                            type: 'object',
                            properties: {
                                hold: { type: 'number', example: 0.5, description: 'Deviation % to HOLD (no action)' },
                                tradeLow: { type: 'number', example: 2, description: 'Deviation % for low urgency trades' },
                                tradeMedium: { type: 'number', example: 5, description: 'Deviation % for medium urgency' },
                                tradeHigh: { type: 'number', example: 10, description: 'Deviation % for high urgency' },
                                tradeEmergency: { type: 'number', example: 15, description: 'Deviation % for emergency action' }
                            }
                        },
                        limits: {
                            type: 'object',
                            properties: {
                                maxTradeBNB: { type: 'number', example: 5, description: 'Max BNB per trade' },
                                maxDailyVolumeBNB: { type: 'number', example: 50, description: 'Max daily trading volume in BNB' },
                                minBalanceBNB: { type: 'number', example: 0.01, description: 'Minimum BNB balance to maintain' }
                            }
                        },
                        slippage: {
                            type: 'object',
                            properties: {
                                low: { type: 'number', example: 1 },
                                medium: { type: 'number', example: 3 },
                                high: { type: 'number', example: 5 },
                                emergency: { type: 'number', example: 10 }
                            },
                            description: 'Slippage tolerance by urgency level (%)'
                        },
                        strategy: {
                            type: 'object',
                            properties: {
                                priceCheckInterval: { type: 'number', example: 60000, description: 'Price check interval (ms)' },
                                minTimeBetweenTrades: { type: 'number', example: 300000, description: 'Cooldown between trades (ms)' }
                            }
                        },
                        safety: {
                            type: 'object',
                            properties: {
                                maxConsecutiveErrors: { type: 'number', example: 3 },
                                autoPauseOnErrors: { type: 'boolean', example: true },
                                circuitBreaker: { type: 'boolean', example: true },
                                circuitBreakerThreshold: { type: 'number', example: 5 }
                            }
                        }
                    }
                },
                SafetyStatus: {
                    type: 'object',
                    properties: {
                        safe: { type: 'boolean', example: true, description: 'Overall safety status' },
                        checks: {
                            type: 'object',
                            properties: {
                                botEnabled: { type: 'boolean', example: true },
                                sufficientBalance: { type: 'boolean', example: true },
                                belowDailyLimit: { type: 'boolean', example: true },
                                liquidityHealthy: { type: 'boolean', example: true },
                                noExcessiveErrors: { type: 'boolean', example: true },
                                circuitBreakerOk: { type: 'boolean', example: true }
                            }
                        },
                        details: {
                            type: 'object',
                            properties: {
                                currentBalance: { type: 'number', example: 0.5 },
                                minRequired: { type: 'number', example: 0.01 },
                                dailyVolume: { type: 'number', example: 12.5 },
                                dailyLimit: { type: 'number', example: 50 },
                                consecutiveErrors: { type: 'number', example: 0 },
                                maxErrors: { type: 'number', example: 3 },
                                liquidityUSD: { type: 'number', example: 10956789.12 }
                            }
                        }
                    }
                },
                HealthStatus: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['healthy', 'unhealthy'], example: 'healthy' },
                        services: {
                            type: 'object',
                            properties: {
                                priceOracle: { type: 'boolean', example: true },
                                tradeExecutor: { type: 'boolean', example: true },
                                database: { type: 'boolean', example: true }
                            }
                        },
                        uptime: { type: 'number', example: 86400, description: 'Service uptime in seconds' },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                }
            }
        },
        tags: [
            {
                name: 'Health',
                description: 'Service health and status endpoints'
            },
            {
                name: 'Admin',
                description: 'Administrative endpoints for API key management (requires X-Admin-Secret header)'
            },
            {
                name: 'Tokens',
                description: 'Token distribution and management endpoints'
            },
            {
                name: 'Players',
                description: 'Player statistics and information endpoints'
            },
            {
                name: 'Bot',
                description: 'Automated trading bot endpoints - Price monitoring, trade execution, portfolio management, and safety checks for maintaining MWT/BNB peg on PancakeSwap'
            }
        ]
    },
    apis: ['./src/routes/*.js'] // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs;