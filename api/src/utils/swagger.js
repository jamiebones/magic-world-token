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
                url: process.env.NODE_ENV === 'production'
                    ? 'https://api.magicworldtoken.com'
                    : `http://localhost:${process.env.PORT || 3000}`,
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
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
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        transactionHash: {
                            type: 'string',
                            example: '0x1234567890abcdef...'
                        },
                        blockNumber: {
                            type: 'integer',
                            example: 12345678
                        },
                        gasUsed: {
                            type: 'string',
                            example: '150000'
                        },
                        recipients: {
                            type: 'integer',
                            example: 2
                        },
                        totalAmount: {
                            type: 'string',
                            example: '150'
                        },
                        reason: {
                            type: 'string',
                            example: 'Tournament Prize Distribution'
                        }
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
            }
        ]
    },
    apis: ['./src/routes/*.js'], // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs;