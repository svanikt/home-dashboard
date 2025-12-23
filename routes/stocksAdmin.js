const express = require('express');
const { getStateKey, setStateKey } = require('../lib/state');
const { StockService } = require('../services/stockService');

const router = express.Router();

/**
 * Get symbols for a dashboard
 * @param {string} dashboardId - Dashboard ID
 * @returns {Array} Array of symbols
 */
function getSymbols(dashboardId) {
  const key = `${dashboardId}_stock_symbols`;
  const symbols = getStateKey(key, []);
  // Return default symbols if none configured
  if (symbols.length === 0) {
    return ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'BTC-USD', 'ETH-USD'];
  }
  return symbols;
}

/**
 * Set symbols for a dashboard
 * @param {string} dashboardId - Dashboard ID
 * @param {Array} symbols - Array of symbols
 */
function setSymbols(dashboardId, symbols) {
  const key = `${dashboardId}_stock_symbols`;
  setStateKey(key, symbols);
}

/**
 * GET /stocks-admin/:dashboardId - Stocks admin page
 */
router.get('/stocks-admin/:dashboardId', (req, res) => {
  try {
    const dashboardId = req.params.dashboardId;
    const symbols = getSymbols(dashboardId);

    res.render('stocks-admin', {
      dashboardId,
      symbols,
      title: `Stock Admin - ${dashboardId}`,
    });
  } catch (error) {
    console.error('Error rendering stocks admin:', error);
    res.status(500).send('Failed to render stocks admin page');
  }
});

/**
 * GET /api/stocks-admin/:dashboardId/symbols - Get current symbols
 */
router.get('/api/stocks-admin/:dashboardId/symbols', (req, res) => {
  try {
    const dashboardId = req.params.dashboardId;
    const symbols = getSymbols(dashboardId);
    res.json({ symbols });
  } catch (error) {
    console.error('Error getting symbols:', error);
    res.status(500).json({ error: 'Failed to get symbols' });
  }
});

/**
 * POST /api/stocks-admin/:dashboardId/symbols - Update symbols
 * Body: { symbols: ['AAPL', 'BTC-USD', ...] }
 */
router.post('/api/stocks-admin/:dashboardId/symbols', express.json(), (req, res) => {
  try {
    const dashboardId = req.params.dashboardId;
    const { symbols } = req.body;

    if (!Array.isArray(symbols)) {
      return res.status(400).json({ error: 'symbols must be an array' });
    }

    // Validate and clean symbols
    const cleanedSymbols = symbols
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);

    setSymbols(dashboardId, cleanedSymbols);

    res.json({
      success: true,
      symbols: cleanedSymbols,
    });
  } catch (error) {
    console.error('Error updating symbols:', error);
    res.status(500).json({ error: 'Failed to update symbols' });
  }
});

/**
 * POST /api/stocks-admin/:dashboardId/symbols/add - Add a symbol
 * Body: { symbol: 'AAPL' }
 */
router.post('/api/stocks-admin/:dashboardId/symbols/add', express.json(), (req, res) => {
  try {
    const dashboardId = req.params.dashboardId;
    const { symbol } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'symbol is required' });
    }

    const cleanedSymbol = symbol.trim().toUpperCase();
    const symbols = getSymbols(dashboardId);

    if (symbols.includes(cleanedSymbol)) {
      return res.status(400).json({ error: 'Symbol already exists' });
    }

    symbols.push(cleanedSymbol);
    setSymbols(dashboardId, symbols);

    res.json({
      success: true,
      symbols,
    });
  } catch (error) {
    console.error('Error adding symbol:', error);
    res.status(500).json({ error: 'Failed to add symbol' });
  }
});

/**
 * DELETE /api/stocks-admin/:dashboardId/symbols/:symbol - Remove a symbol
 */
router.delete('/api/stocks-admin/:dashboardId/symbols/:symbol', (req, res) => {
  try {
    const dashboardId = req.params.dashboardId;
    const symbolToRemove = req.params.symbol.toUpperCase();
    const symbols = getSymbols(dashboardId);

    const newSymbols = symbols.filter(s => s !== symbolToRemove);

    if (newSymbols.length === symbols.length) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    setSymbols(dashboardId, newSymbols);

    res.json({
      success: true,
      symbols: newSymbols,
    });
  } catch (error) {
    console.error('Error removing symbol:', error);
    res.status(500).json({ error: 'Failed to remove symbol' });
  }
});

/**
 * POST /api/stocks-admin/:dashboardId/validate - Validate a symbol
 * Body: { symbol: 'AAPL' }
 */
router.post('/api/stocks-admin/:dashboardId/validate', express.json(), async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'symbol is required' });
    }

    const stockService = new StockService();
    const cleanedSymbol = symbol.trim().toUpperCase();

    // Try to fetch data for this symbol
    try {
      const data = await stockService.fetchStockData(cleanedSymbol, console);
      res.json({
        valid: true,
        symbol: cleanedSymbol,
        name: data.name,
        type: data.type,
      });
    } catch (error) {
      res.json({
        valid: false,
        symbol: cleanedSymbol,
        error: error.message,
      });
    }
  } catch (error) {
    console.error('Error validating symbol:', error);
    res.status(500).json({ error: 'Failed to validate symbol' });
  }
});

module.exports = router;
