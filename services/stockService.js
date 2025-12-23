const axios = require('axios');
const { BaseService } = require('../lib/BaseService');

/**
 * Stock Service - Fetches real-time stock and crypto prices
 * Uses Yahoo Finance API (free, no API key required)
 *
 * Supports:
 * - Stocks: AAPL, GOOGL, MSFT, etc.
 * - Crypto: BTC-USD, ETH-USD, DOGE-USD, etc.
 */
class StockService extends BaseService {
  constructor(cacheTTLMinutes = 5) {
    super({
      name: 'Stock Prices',
      cacheKey: 'stocks',
      cacheTTL: cacheTTLMinutes * 60 * 1000,
      retryAttempts: 3,
      retryCooldown: 1000,
    });
  }

  isEnabled() {
    // Stock service doesn't require API key (using free Yahoo Finance)
    return true;
  }

  /**
   * Fetch stock data for given symbols
   * @param {Object} config - { symbols: ['AAPL', 'GOOGL', ...] }
   * @param {Object} logger - Logger instance
   * @returns {Promise<Array>} Array of stock data
   */
  async fetchData(config, logger) {
    const symbols = config.symbols || [];

    if (!symbols || symbols.length === 0) {
      throw new Error('No stock symbols provided');
    }

    logger.info?.(`[Stock Service] Fetching data for symbols: ${symbols.join(', ')}`);

    // Fetch all symbols in parallel
    const promises = symbols.map(symbol => this.fetchStockData(symbol, logger));
    const results = await Promise.allSettled(promises);

    // Filter out failed requests and return successful ones
    const stockData = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    // Log failed symbols
    const failedSymbols = results
      .filter(result => result.status === 'rejected')
      .map((result, idx) => ({ symbol: symbols[idx], reason: result.reason.message }));

    if (failedSymbols.length > 0) {
      logger.warn?.(`[Stock Service] Failed to fetch ${failedSymbols.length} symbols:`, failedSymbols);
    }

    if (stockData.length === 0) {
      throw new Error('Failed to fetch data for all symbols');
    }

    logger.info?.(`[Stock Service] Successfully fetched ${stockData.length}/${symbols.length} symbols`);

    return stockData;
  }

  /**
   * Fetch data for a single stock symbol using Yahoo Finance API
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Stock data
   */
  async fetchStockData(symbol, logger) {
    try {
      // Using Yahoo Finance API v8 (free, no API key)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      const params = {
        interval: '1d',
        range: '5d',
      };

      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const data = response.data;

      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error(`No data returned for ${symbol}`);
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];

      if (!meta || !quote) {
        throw new Error(`Invalid data structure for ${symbol}`);
      }

      // Get current price (last close or regularMarketPrice)
      const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];

      // Get previous close for calculating change
      const previousClose = meta.chartPreviousClose || meta.previousClose;

      // Calculate change and change percent
      const change = currentPrice - previousClose;
      const changePercent = (change / previousClose) * 100;

      // Get 5-day data for sparkline
      const timestamps = result.timestamp || [];
      const closePrices = quote.close || [];
      const sparklineData = timestamps.slice(-5).map((ts, idx) => ({
        timestamp: ts,
        price: closePrices[closePrices.length - 5 + idx],
      }));

      // Detect if this is a crypto asset
      const isCrypto = symbol.includes('-') && (
        symbol.endsWith('-USD') ||
        symbol.endsWith('-EUR') ||
        symbol.endsWith('-GBP')
      );

      return {
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || meta.symbol,
        price: currentPrice,
        previousClose,
        change,
        changePercent,
        currency: meta.currency || 'USD',
        marketState: meta.marketState, // 'REGULAR', 'PRE', 'POST', 'CLOSED'
        exchange: meta.exchangeName,
        sparkline: sparklineData,
        timestamp: Date.now(),
        isCrypto,
        type: isCrypto ? 'crypto' : 'stock',
      };
    } catch (error) {
      logger.error?.(`[Stock Service] Failed to fetch ${symbol}:`, error.message);
      throw new Error(`Failed to fetch ${symbol}: ${error.message}`);
    }
  }

  /**
   * Map raw stock data to dashboard format
   * @param {Array} apiData - Raw stock data from API
   * @param {Object} config - Configuration
   * @returns {Array} Formatted stock data
   */
  mapToDashboard(apiData, config) {
    return apiData.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: this.formatPrice(stock.price),
      previousClose: this.formatPrice(stock.previousClose),
      change: this.formatChange(stock.change),
      changePercent: this.formatPercent(stock.changePercent),
      direction: stock.change >= 0 ? 'up' : 'down',
      currency: stock.currency,
      marketState: stock.marketState,
      exchange: stock.exchange,
      sparkline: stock.sparkline,
      type: stock.type,
      isCrypto: stock.isCrypto,
      lastUpdated: new Date(stock.timestamp).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    }));
  }

  /**
   * Format price to 2 decimal places
   * @param {number} price - Price value
   * @returns {string} Formatted price
   */
  formatPrice(price) {
    if (price == null) return 'N/A';
    return price.toFixed(2);
  }

  /**
   * Format change with + or - sign
   * @param {number} change - Change value
   * @returns {string} Formatted change
   */
  formatChange(change) {
    if (change == null) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  }

  /**
   * Format percent with + or - sign and % symbol
   * @param {number} percent - Percent value
   * @returns {string} Formatted percent
   */
  formatPercent(percent) {
    if (percent == null) return 'N/A';
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  }
}

module.exports = { StockService };
