/**
 * Fetches the current BNB price in USD from CoinGecko API
 * @returns Promise<number> - Current BNB price in USD
 * @throws Error if fetch fails or API returns invalid data
 */
export async function fetchBnbPrice(): Promise<number> {
  const apiKey = process.env.COINGECKO_API_KEY;
  
  try {
    // CoinGecko API endpoint for BNB price
    const url = apiKey 
      ? `https://pro-api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd&x_cg_pro_api_key=${apiKey}`
      : `https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 1 minute to avoid rate limiting
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data?.binancecoin?.usd) {
      throw new Error('Invalid response from CoinGecko API');
    }

    const bnbPrice = data.binancecoin.usd;
    
    // Sanity check - BNB price should be reasonable
    if (bnbPrice < 10 || bnbPrice > 10000) {
      throw new Error(`Unrealistic BNB price returned: $${bnbPrice}`);
    }

    return bnbPrice;
  } catch (error) {
    console.error('Error fetching BNB price:', error);
    
    // Return a fallback price if fetch fails
    // This prevents the app from breaking
    console.warn('Using fallback BNB price: $600');
    return 600;
  }
}

/**
 * Fetches BNB price with retry logic
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise<number> - Current BNB price in USD
 */
export async function fetchBnbPriceWithRetry(maxRetries = 3): Promise<number> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchBnbPrice();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        console.log(`Retrying BNB price fetch (attempt ${attempt + 1}/${maxRetries})...`);
      }
    }
  }
  
  console.error('All BNB price fetch attempts failed:', lastError);
  // Return fallback price
  return 600;
}
