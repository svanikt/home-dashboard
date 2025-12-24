const { StockService } = require('../../services/stockService');
const { CalendarService } = require('../../services/calendarService');
const { getStateKey } = require('../state');
const messageBoard = require('../messageBoard');

/**
 * Build stocks dashboard data
 *
 * @param {Object} dashboardConfig - Dashboard configuration
 * @param {Object} req - Express request object (for baseUrl)
 * @param {Object} logger - Logger instance
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data
 * @returns {Promise<Object>} Complete dashboard data model
 */
async function buildStocksDashboardData(dashboardConfig, req, logger = console, forceRefresh = false) {
  const now = new Date();

  // Initialize services based on dashboard config
  // Use configured refresh interval (in seconds), convert to minutes for cache TTL
  const refreshIntervalSeconds = dashboardConfig.services.stocks?.refreshInterval || 300;
  const cacheTTLMinutes = refreshIntervalSeconds / 60;
  const stockService = new StockService(cacheTTLMinutes);
  const calendarService = dashboardConfig.services.calendar?.enabled
    ? new CalendarService()
    : null;

  // Get symbols from state (user-configured via admin page)
  const symbolsKey = `${dashboardConfig.id}_stock_symbols`;
  const symbols = getStateKey(symbolsKey, dashboardConfig.services.stocks?.symbols || []);

  // Fetch stock data (REQUIRED for stocks dashboard)
  let stockData = [];
  let stockStatus;
  try {
    const stockConfig = {
      symbols,
    };
    const result = await stockService.getData(stockConfig, logger, forceRefresh);
    stockData = result.data;
    stockStatus = result.status;
  } catch (error) {
    logger.error?.('[StocksDataBuilder] Stock service failed (REQUIRED):', error.message);
    throw new Error(`Stock API unavailable: ${error.message}`);
  }

  // Fetch calendar data (OPTIONAL)
  let calendar_events = [];
  let calendarStatus;
  if (calendarService) {
    try {
      const baseUrl = req.protocol + '://' + req.get('host');
      const calendarConfig = {
        baseUrl,
        timezone: 'America/New_York', // TODO: Make configurable per dashboard
      };
      const result = await calendarService.getData(calendarConfig, logger);
      calendar_events = result.data || [];
      calendarStatus = result.status;
    } catch (error) {
      logger.info?.('[StocksDataBuilder] Calendar service unavailable (optional):', error.message);
      calendarStatus = calendarService.getStatus();
    }
  }

  // Fetch message board (always shows either custom message or time-based greeting)
  const timezone = 'America/New_York'; // TODO: Make configurable per dashboard
  let message = null;
  try {
    message = messageBoard.getDisplayMessage(timezone);
    logger.info?.('[StocksDataBuilder] Message board:', message.isGreeting ? `greeting: "${message.text}"` : 'custom message');
  } catch (error) {
    logger.info?.('[StocksDataBuilder] Message board error (optional):', error.message);
  }

  // Format time in timezone
  const formatTimeInTimezone = (date) => {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Calculate market summary
  const marketSummary = calculateMarketSummary(stockData);

  // Build base data model
  const data = {
    stocks: stockData,
    marketSummary,
    calendar_events,
    message,
    date: now.toISOString(),
    last_updated: formatTimeInTimezone(now),
    timezone: timezone,
  };

  // Attach service statuses for admin panel
  data._serviceStatuses = {
    stocks: stockStatus,
    calendar: calendarStatus || { enabled: false },
  };

  return data;
}

/**
 * Calculate market summary statistics
 * @param {Array} stockData - Array of stock data
 * @returns {Object} Market summary
 */
function calculateMarketSummary(stockData) {
  if (!stockData || stockData.length === 0) {
    return {
      totalStocks: 0,
      gainers: 0,
      losers: 0,
      unchanged: 0,
      avgChange: 0,
    };
  }

  let gainers = 0;
  let losers = 0;
  let unchanged = 0;
  let totalChange = 0;

  stockData.forEach(stock => {
    const change = parseFloat(stock.change);
    if (change > 0) gainers++;
    else if (change < 0) losers++;
    else unchanged++;
    totalChange += change;
  });

  return {
    totalStocks: stockData.length,
    gainers,
    losers,
    unchanged,
    avgChange: (totalChange / stockData.length).toFixed(2),
  };
}

module.exports = {
  buildStocksDashboardData,
};
