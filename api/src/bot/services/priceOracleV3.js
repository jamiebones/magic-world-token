const { ethers } = require('ethers');

/**
 * PriceOracleV3 - Fetches prices for V3 pools using tick-based pricing
 * 
 * V3 pools use concentrated liquidity with tick-based pricing:
 * - sqrtPriceX96 represents the square root of the price scaled by 2^96
 * - price = (sqrtPriceX96 / 2^96)^2
 * - Must account for token decimals
 */
class PriceOracleV3 {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);

        // V3 Pool ABI - minimal for price reading
        this.poolABI = [
            'function token0() external view returns (address)',
            'function token1() external view returns (address)',
            'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
            'function liquidity() external view returns (uint128)'
        ];

        // Chainlink price feed ABI
        this.chainlinkABI = [
            'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
            'function decimals() external view returns (uint8)'
        ];

        // ERC20 ABI for decimals
        this.erc20ABI = [
            'function decimals() external view returns (uint8)'
        ];

        // Cache configuration
        this.cache = {
            prices: null,
            timestamp: 0,
            duration: 60000 // 1 minute cache
        };

        // Addresses
        this.V3_POOL_ADDRESS = process.env.MWT_BNB_PAIR_ADDRESS;
        this.MWT_ADDRESS = process.env.MWT_TOKEN_ADDRESS || '0x73331cb65cfb32b609178B75F70e00216b788401';
        this.WBNB_ADDRESS = process.env.WBNB_ADDRESS;
        this.BNB_USD_FEED = process.env.CHAINLINK_BNB_USD_FEED;
        this.BTC_USD_FEED = process.env.CHAINLINK_BTC_USD_FEED;
    }

    /**
     * Calculate price from V3 sqrtPriceX96
     * @param {BigInt} sqrtPriceX96 - Square root price scaled by 2^96
     * @param {number} decimals0 - Token0 decimals
     * @param {number} decimals1 - Token1 decimals
     * @param {boolean} isToken0Base - If true, return price as token0/token1; else token1/token0
     * @returns {number} Price
     */
    calculatePriceFromSqrt(sqrtPriceX96, decimals0, decimals1, isToken0Base = true) {
        try {
            // Convert to BigInt if string
            const sqrtPrice = typeof sqrtPriceX96 === 'string' ? BigInt(sqrtPriceX96) : sqrtPriceX96;

            // Q96 = 2^96
            const Q96 = BigInt(2) ** BigInt(96);

            // price = (sqrtPriceX96 / 2^96)^2
            // To avoid overflow, we calculate: (sqrtPriceX96^2) / (2^192)
            // Then adjust for decimals

            // Calculate numerator and denominator with proper scaling
            const numerator = sqrtPrice * sqrtPrice;
            const denominator = Q96 * Q96;

            // Convert to Number first, then apply decimal adjustment
            // price in token1 per token0 = (sqrtPrice/Q96)^2
            let price = Number(numerator) / Number(denominator);

            // Apply decimal adjustment (ensure decimals are numbers)
            const dec0 = typeof decimals0 === 'bigint' ? Number(decimals0) : decimals0;
            const dec1 = typeof decimals1 === 'bigint' ? Number(decimals1) : decimals1;
            const decimalDiff = dec1 - dec0;
            price = price * Math.pow(10, decimalDiff);

            // If we want token0/token1 (e.g., MWT/BNB), return as is
            // If we want token1/token0 (e.g., BNB/MWT), invert
            return isToken0Base ? 1 / price : price;

        } catch (error) {
            console.error('Error calculating price from sqrtPriceX96:', error);
            throw error;
        }
    }

    /**
     * Get MWT/BNB price from V3 pool
     * @returns {Promise<number>} Price in BNB per MWT
     */
    async getMWTBNBPrice() {
        try {
            const pool = new ethers.Contract(this.V3_POOL_ADDRESS, this.poolABI, this.provider);

            // Get slot0 data (contains sqrtPriceX96 and tick)
            const slot0 = await pool.slot0();
            const sqrtPriceX96 = slot0.sqrtPriceX96;

            // Get token order
            const token0 = await pool.token0();
            const token1 = await pool.token1();

            // Get decimals
            const token0Contract = new ethers.Contract(token0, this.erc20ABI, this.provider);
            const token1Contract = new ethers.Contract(token1, this.erc20ABI, this.provider);
            const decimals0 = await token0Contract.decimals();
            const decimals1 = await token1Contract.decimals();

            // Determine if MWT is token0 or token1
            const isMWTToken0 = token0.toLowerCase() === this.MWT_ADDRESS.toLowerCase();

            // Calculate price
            // sqrtPriceX96 represents sqrt(token1/token0)
            // So price = (sqrtPriceX96 / 2^96)^2 gives us token1/token0
            let mwtBnbPrice;

            if (isMWTToken0) {
                // MWT is token0, WBNB is token1
                // sqrtPriceX96 gives us WBNB/MWT (token1/token0)
                // This is exactly MWT/WBNB since token1=WBNB and token0=MWT
                // So token1/token0 = WBNB/MWT, which IS the price we want!
                mwtBnbPrice = this.calculatePriceFromSqrt(sqrtPriceX96, decimals0, decimals1, false);
            } else {
                // WBNB is token0, MWT is token1
                // sqrtPriceX96 gives us MWT/WBNB (token1/token0)
                // This is what we want!
                mwtBnbPrice = this.calculatePriceFromSqrt(sqrtPriceX96, decimals0, decimals1, false);
            }

            return mwtBnbPrice;

        } catch (error) {
            console.error('Error fetching MWT/BNB price from V3:', error);
            throw new Error(`Failed to fetch V3 pool price: ${error.message}`);
        }
    }

    /**
     * Get BNB/USD price from Chainlink
     * @returns {Promise<number>} Price in USD per BNB
     */
    async getBNBUSDPrice() {
        try {
            const feed = new ethers.Contract(this.BNB_USD_FEED, this.chainlinkABI, this.provider);
            const [roundId, answer, startedAt, updatedAt, answeredInRound] = await feed.latestRoundData();
            const decimals = await feed.decimals();

            const price = Number(answer) / (10 ** Number(decimals));

            // Validate price
            if (price <= 0 || price > 10000) {
                throw new Error(`Invalid BNB/USD price: ${price}`);
            }

            return price;
        } catch (error) {
            console.error('Error fetching BNB/USD price:', error);
            throw new Error(`Failed to fetch Chainlink BNB/USD price: ${error.message}`);
        }
    }

    /**
     * Get BTC/USD price from Chainlink
     * @returns {Promise<number>} Price in USD per BTC
     */
    async getBTCUSDPrice() {
        try {
            const feed = new ethers.Contract(this.BTC_USD_FEED, this.chainlinkABI, this.provider);
            const [roundId, answer, startedAt, updatedAt, answeredInRound] = await feed.latestRoundData();
            const decimals = await feed.decimals();

            const price = Number(answer) / (10 ** Number(decimals));

            // Validate price
            if (price <= 0 || price > 200000) {
                throw new Error(`Invalid BTC/USD price: ${price}`);
            }

            return price;
        } catch (error) {
            console.error('Error fetching BTC/USD price:', error);
            throw new Error(`Failed to fetch Chainlink BTC/USD price: ${error.message}`);
        }
    }

    /**
     * Get pool liquidity
     * @returns {Promise<string>} Liquidity in the pool
     */
    async getLiquidity() {
        try {
            const pool = new ethers.Contract(this.V3_POOL_ADDRESS, this.poolABI, this.provider);
            const liquidity = await pool.liquidity();
            return liquidity.toString();
        } catch (error) {
            console.error('Error fetching pool liquidity:', error);
            throw new Error(`Failed to fetch pool liquidity: ${error.message}`);
        }
    }

    /**
     * Get all prices (with caching)
     * @param {boolean} forceRefresh - Force refresh cache
     * @returns {Promise<Object>} All prices
     */
    async getAllPrices(forceRefresh = false) {
        const now = Date.now();

        // Return cached data if still valid
        if (!forceRefresh && this.cache.prices && (now - this.cache.timestamp < this.cache.duration)) {
            return this.cache.prices;
        }

        try {
            // Fetch all prices in parallel
            const [mwtBnbPrice, bnbUsdPrice, btcUsdPrice, liquidity] = await Promise.all([
                this.getMWTBNBPrice(),
                this.getBNBUSDPrice(),
                this.getBTCUSDPrice(),
                this.getLiquidity()
            ]);

            // Calculate derived prices
            const mwtUsdPrice = mwtBnbPrice * bnbUsdPrice;
            const mwtBtcPrice = mwtUsdPrice / btcUsdPrice;
            const satoshis = Math.round(mwtBtcPrice * 100000000);

            // Calculate deviation from target
            const targetPeg = parseFloat(process.env.TARGET_PEG_USD || '0.0001');
            const deviation = ((mwtUsdPrice - targetPeg) / targetPeg) * 100;

            const prices = {
                mwtBnb: mwtBnbPrice,
                bnbUsd: bnbUsdPrice,
                btcUsd: btcUsdPrice,
                mwtUsd: mwtUsdPrice,
                mwtBtc: mwtBtcPrice,
                satoshis,
                liquidity,
                deviation,
                targetPeg,
                timestamp: now,
                poolType: 'V3',
                poolAddress: this.V3_POOL_ADDRESS
            };

            // Update cache
            this.cache.prices = prices;
            this.cache.timestamp = now;

            return prices;

        } catch (error) {
            console.error('Error fetching prices:', error);
            throw error;
        }
    }

  /**
   * Get price deviation from target peg
   * @returns {Promise<Object>} Deviation info
   */
  async getDeviation() {
    const prices = await this.getAllPrices();
    
    return {
      currentPrice: prices.mwtUsd,
      targetPrice: prices.targetPeg,
      deviation: prices.deviation,
      deviationPercentage: `${prices.deviation.toFixed(2)}%`,
      isOverPeg: prices.deviation > 0,
      isUnderPeg: prices.deviation < 0,
      timestamp: prices.timestamp
    };
  }

  /**
   * Get peg deviation (alias for compatibility)
   * @param {number} targetPeg - Optional target peg override
   * @returns {Promise<Object>} Deviation info
   */
  async getPegDeviation(targetPeg = null) {
    const prices = await this.getAllPrices();
    const target = targetPeg || prices.targetPeg;
    const deviation = ((prices.mwtUsd - target) / target) * 100;
    
    return {
      currentPrice: prices.mwtUsd,
      targetPrice: target,
      deviation: deviation,
      deviationPercentage: `${deviation.toFixed(2)}%`,
      isOverPeg: deviation > 0,
      isUnderPeg: deviation < 0,
      absoluteDeviation: Math.abs(deviation),
      timestamp: prices.timestamp
    };
  }

  /**
   * Get liquidity depth for trading
   * @returns {Promise<Object>} Liquidity info
   */
  async getLiquidityDepth() {
    try {
      const pool = new ethers.Contract(this.V3_POOL_ADDRESS, this.poolABI, this.provider);
      const [liquidity, slot0] = await Promise.all([
        pool.liquidity(),
        pool.slot0()
      ]);

      const prices = await this.getAllPrices();

      return {
        totalLiquidity: liquidity.toString(),
        currentTick: slot0.tick.toString(),
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        mwtUsdPrice: prices.mwtUsd,
        mwtBnbPrice: prices.mwtBnb,
        poolType: 'V3',
        poolAddress: this.V3_POOL_ADDRESS,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching liquidity depth:', error);
      throw new Error(`Failed to fetch liquidity depth: ${error.message}`);
    }
  }

  /**
   * Get current prices (alias for compatibility)
   * @returns {Promise<Object>} Current prices
   */
  async getCurrentPrices() {
    return this.getAllPrices();
  }
}

module.exports = PriceOracleV3;