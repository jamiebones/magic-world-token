const { ethers } = require('ethers');
const logger = require('../../utils/logger');

// Contract ABIs
const PancakePairABI = require('../../../contracts/abis/IPancakePair.json');
const ChainlinkAggregatorABI = require('../../../contracts/abis/IChainlinkAggregator.json');

class PriceOracle {
    constructor() {
        // Validate required environment variables
        const required = {
            BSC_MAINNET_RPC_URL: process.env.BSC_MAINNET_RPC_URL,
            MWT_BNB_PAIR_ADDRESS: process.env.MWT_BNB_PAIR_ADDRESS,
            CHAINLINK_BNB_USD_FEED: process.env.CHAINLINK_BNB_USD_FEED,
            CHAINLINK_BTC_USD_FEED: process.env.CHAINLINK_BTC_USD_FEED
        };

        const missing = Object.entries(required).filter(([k, v]) => !v).map(([k]) => k);
        if (missing.length > 0) {
            throw new Error(`PriceOracle: Missing required environment variables: ${missing.join(', ')}`);
        }

        // Use BSC Mainnet for production price data
        this.provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);

        // Initialize contract instances
        this.pairContract = new ethers.Contract(
            process.env.MWT_BNB_PAIR_ADDRESS,
            PancakePairABI,
            this.provider
        );

        // Chainlink BNB/USD feed on BSC
        this.chainlinkBNBUSD = new ethers.Contract(
            process.env.CHAINLINK_BNB_USD_FEED,
            ChainlinkAggregatorABI,
            this.provider
        );

        // Chainlink BTC/USD feed on BSC
        this.chainlinkBTCUSD = new ethers.Contract(
            process.env.CHAINLINK_BTC_USD_FEED,
            ChainlinkAggregatorABI,
            this.provider
        );

        // Cache for Chainlink prices (to avoid excessive RPC calls)
        this.priceCache = {
            btcUsd: { price: null, timestamp: 0 },
            bnbUsd: { price: null, timestamp: 0 }
        };
        this.CACHE_DURATION = 60000; // 1 minute cache
    }

    /**
     * Get MWT/BNB price from PancakeSwap pair reserves
     * @returns {Promise<Object>} MWT/BNB price data
     */
    async getMWTBNBPrice() {
        try {
            // Get reserves from pair
            const [reserve0, reserve1, timestamp] = await this.pairContract.getReserves();

            // Get token addresses to determine which is MWT
            const token0 = await this.pairContract.token0();
            const token1 = await this.pairContract.token1();

            // Calculate price based on token order
            let mwtReserve, bnbReserve;

            if (token0.toLowerCase() === process.env.TOKEN_CONTRACT_ADDRESS.toLowerCase()) {
                mwtReserve = reserve0;
                bnbReserve = reserve1;
            } else {
                mwtReserve = reserve1;
                bnbReserve = reserve0;
            }

            // Price = BNB reserve / MWT reserve
            const price = Number(ethers.formatEther(bnbReserve)) /
                Number(ethers.formatEther(mwtReserve));

            return {
                mwtBnbPrice: price,
                mwtReserve: ethers.formatEther(mwtReserve),
                bnbReserve: ethers.formatEther(bnbReserve),
                blockTimestamp: Number(timestamp),
                token0,
                token1
            };

        } catch (error) {
            logger.error('Error fetching MWT/BNB price:', error);
            throw error;
        }
    }

    /**
     * Get BNB/USD price from Chainlink oracle
     * @returns {Promise<Object>} BNB/USD price data
     */
    async getBNBUSDPrice() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.priceCache.bnbUsd.price &&
                (now - this.priceCache.bnbUsd.timestamp) < this.CACHE_DURATION) {
                return this.priceCache.bnbUsd.price;
            }

            const [roundId, answer, startedAt, updatedAt, answeredInRound] =
                await this.chainlinkBNBUSD.latestRoundData();

            const decimals = await this.chainlinkBNBUSD.decimals();
            const price = Number(answer) / Math.pow(10, Number(decimals));

            const result = {
                bnbUsdPrice: price,
                lastUpdate: new Date(Number(updatedAt) * 1000),
                roundId: Number(roundId),
                source: 'Chainlink BNB/USD'
            };

            // Update cache
            this.priceCache.bnbUsd = {
                price: result,
                timestamp: now
            };

            return result;

        } catch (error) {
            logger.error('Error fetching BNB/USD price from Chainlink:', error);
            throw error;
        }
    }

    /**
     * Get BTC/USD price from Chainlink oracle
     * @returns {Promise<Object>} BTC/USD price data
     */
    async getBTCUSDPrice() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.priceCache.btcUsd.price &&
                (now - this.priceCache.btcUsd.timestamp) < this.CACHE_DURATION) {
                return this.priceCache.btcUsd.price;
            }

            const [roundId, answer, startedAt, updatedAt, answeredInRound] =
                await this.chainlinkBTCUSD.latestRoundData();

            const decimals = await this.chainlinkBTCUSD.decimals();
            const price = Number(answer) / Math.pow(10, Number(decimals));

            const result = {
                btcUsdPrice: price,
                lastUpdate: new Date(Number(updatedAt) * 1000),
                roundId: Number(roundId),
                source: 'Chainlink BTC/USD'
            };

            // Update cache
            this.priceCache.btcUsd = {
                price: result,
                timestamp: now
            };

            return result;

        } catch (error) {
            logger.error('Error fetching BTC/USD price from Chainlink:', error);
            throw error;
        }
    }

    /**
     * Calculate MWT/USD price
     * Formula: MWT/USD = MWT/BNB × BNB/USD
     * @returns {Promise<Object>} MWT/USD price data
     */
    async getMWTUSDPrice() {
        try {
            const mwtBnb = await this.getMWTBNBPrice();
            const bnbUsd = await this.getBNBUSDPrice();

            const mwtUsdPrice = mwtBnb.mwtBnbPrice * bnbUsd.bnbUsdPrice;

            return {
                mwtUsdPrice,
                mwtBnbPrice: mwtBnb.mwtBnbPrice,
                bnbUsdPrice: bnbUsd.bnbUsdPrice,
                mwtReserve: mwtBnb.mwtReserve,
                bnbReserve: mwtBnb.bnbReserve,
                liquidityUSD: (parseFloat(mwtBnb.bnbReserve) * 2) * bnbUsd.bnbUsdPrice,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Error calculating MWT/USD price:', error);
            throw error;
        }
    }

    /**
     * Calculate MWT/BTC price
     * Formula: MWT/BTC = (MWT/BNB × BNB/USD) ÷ BTC/USD
     * @returns {Promise<Object>} MWT/BTC price data
     */
    async getMWTBTCPrice() {
        try {
            const mwtBnb = await this.getMWTBNBPrice();
            const bnbUsd = await this.getBNBUSDPrice();
            const btcUsd = await this.getBTCUSDPrice();

            // Calculate MWT/USD first
            const mwtUsdPrice = mwtBnb.mwtBnbPrice * bnbUsd.bnbUsdPrice;

            // Then calculate MWT/BTC
            const mwtBtcPrice = mwtUsdPrice / btcUsd.btcUsdPrice;

            return {
                mwtBtcPrice,
                mwtUsdPrice,
                btcUsdPrice: btcUsd.btcUsdPrice,
                mwtBnbPrice: mwtBnb.mwtBnbPrice,
                bnbUsdPrice: bnbUsd.bnbUsdPrice,
                satoshis: Math.floor(mwtBtcPrice * 100000000),
                calculation: `(${mwtBnb.mwtBnbPrice.toFixed(10)} × ${bnbUsd.bnbUsdPrice.toFixed(2)}) ÷ ${btcUsd.btcUsdPrice.toFixed(2)} = ${mwtBtcPrice.toFixed(15)}`,
                sources: {
                    mwtBnb: 'PancakeSwap Pair',
                    bnbUsd: 'Chainlink BNB/USD',
                    btcUsd: 'Chainlink BTC/USD'
                },
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Error calculating MWT/BTC price:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive price data (all trading pairs)
     * @returns {Promise<Object>} All price data
     */
    async getAllPrices() {
        try {
            const [mwtBnb, bnbUsd, btcUsd] = await Promise.all([
                this.getMWTBNBPrice(),
                this.getBNBUSDPrice(),
                this.getBTCUSDPrice()
            ]);

            // Calculate derived prices
            const mwtUsdPrice = mwtBnb.mwtBnbPrice * bnbUsd.bnbUsdPrice;
            const mwtBtcPrice = mwtUsdPrice / btcUsd.btcUsdPrice;
            const bnbBtcPrice = bnbUsd.bnbUsdPrice / btcUsd.btcUsdPrice;

            return {
                // Base pair (from DEX)
                mwtBnb: {
                    price: mwtBnb.mwtBnbPrice,
                    mwtReserve: mwtBnb.mwtReserve,
                    bnbReserve: mwtBnb.bnbReserve,
                    source: 'PancakeSwap'
                },

                // Fiat prices (from Chainlink)
                bnbUsd: {
                    price: bnbUsd.bnbUsdPrice,
                    source: 'Chainlink',
                    lastUpdate: bnbUsd.lastUpdate
                },
                btcUsd: {
                    price: btcUsd.btcUsdPrice,
                    source: 'Chainlink',
                    lastUpdate: btcUsd.lastUpdate
                },

                // Derived prices
                mwtUsd: {
                    price: mwtUsdPrice,
                    calculation: `${mwtBnb.mwtBnbPrice.toFixed(10)} × ${bnbUsd.bnbUsdPrice.toFixed(2)}`,
                    source: 'Calculated'
                },
                mwtBtc: {
                    price: mwtBtcPrice,
                    satoshis: Math.floor(mwtBtcPrice * 100000000),
                    calculation: `(${mwtBnb.mwtBnbPrice.toFixed(10)} × ${bnbUsd.bnbUsdPrice.toFixed(2)}) ÷ ${btcUsd.btcUsdPrice.toFixed(2)}`,
                    source: 'Calculated'
                },
                bnbBtc: {
                    price: bnbBtcPrice,
                    calculation: `${bnbUsd.bnbUsdPrice.toFixed(2)} ÷ ${btcUsd.btcUsdPrice.toFixed(2)}`,
                    source: 'Calculated'
                },

                // Liquidity metrics
                liquidity: {
                    totalUSD: (parseFloat(mwtBnb.bnbReserve) * 2) * bnbUsd.bnbUsdPrice,
                    totalBTC: ((parseFloat(mwtBnb.bnbReserve) * 2) * bnbUsd.bnbUsdPrice) / btcUsd.btcUsdPrice,
                    mwtAmount: mwtBnb.mwtReserve,
                    bnbAmount: mwtBnb.bnbReserve
                },

                // Market cap (assuming 1B total supply)
                marketCap: {
                    usd: mwtUsdPrice * 1000000000,
                    btc: mwtBtcPrice * 1000000000
                },

                timestamp: new Date(),
                blockNumber: await this.provider.getBlockNumber()
            };

        } catch (error) {
            logger.error('Error fetching all prices:', error);
            throw error;
        }
    }

    /**
     * Calculate deviation from target peg (in USD and BTC)
     * @param {number} targetPriceUSD - Target peg price in USD
     * @returns {Promise<Object>} Deviation data
     */
    async getPegDeviation(targetPriceUSD = 0.01) {
        try {
            const prices = await this.getAllPrices();
            const currentPriceUSD = prices.mwtUsd.price;

            const deviation = ((currentPriceUSD - targetPriceUSD) / targetPriceUSD) * 100;

            // Also calculate BTC-denominated deviation if target is BTC-based
            const targetPriceBTC = targetPriceUSD / prices.btcUsd.price;
            const deviationBTC = ((prices.mwtBtc.price - targetPriceBTC) / targetPriceBTC) * 100;

            return {
                usd: {
                    current: currentPriceUSD,
                    target: targetPriceUSD,
                    deviation: deviation,
                    deviationPercent: `${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}%`
                },
                btc: {
                    current: prices.mwtBtc.price,
                    currentSatoshis: prices.mwtBtc.satoshis,
                    target: targetPriceBTC,
                    targetSatoshis: Math.floor(targetPriceBTC * 100000000),
                    deviation: deviationBTC,
                    deviationPercent: `${deviationBTC > 0 ? '+' : ''}${deviationBTC.toFixed(2)}%`
                },
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Error calculating peg deviation:', error);
            throw error;
        }
    }

    /**
     * Validate that prices are within reasonable ranges
     * @param {Object} prices - Price data to validate
     * @returns {boolean} True if prices are valid
     */
    validatePrices(prices) {
        // BTC should be between $20k - $200k
        if (prices.btcUsd.price < 20000 || prices.btcUsd.price > 200000) {
            logger.warn(`BTC price out of range: ${prices.btcUsd.price}`);
            return false;
        }

        // BNB should be between $100 - $1000
        if (prices.bnbUsd.price < 100 || prices.bnbUsd.price > 1000) {
            logger.warn(`BNB price out of range: ${prices.bnbUsd.price}`);
            return false;
        }

        // MWT/BTC should not be zero or negative
        if (prices.mwtBtc.price <= 0) {
            logger.warn(`MWT/BTC price invalid: ${prices.mwtBtc.price}`);
            return false;
        }

        // Liquidity should be > $1000
        if (prices.liquidity.totalUSD < 1000) {
            logger.warn(`Liquidity too low: ${prices.liquidity.totalUSD}`);
            return false;
        }

        return true;
    }

    /**
     * Get liquidity depth for impact calculation
     * @returns {Promise<Object>} Liquidity data
     */
    async getLiquidityDepth() {
        try {
            const priceData = await this.getMWTUSDPrice();

            return {
                mwtLiquidity: parseFloat(priceData.mwtReserve),
                bnbLiquidity: parseFloat(priceData.bnbReserve),
                totalLiquidityUSD: priceData.liquidityUSD
            };

        } catch (error) {
            logger.error('Error fetching liquidity depth:', error);
            throw error;
        }
    }

    /**
     * Clear price cache (useful for testing)
     */
    clearCache() {
        this.priceCache = {
            btcUsd: { price: null, timestamp: 0 },
            bnbUsd: { price: null, timestamp: 0 }
        };
        logger.info('Price cache cleared');
    }
}

module.exports = PriceOracle;
