/**
 * Data Builder Orchestrator
 * Routes to appropriate data builder based on dashboard type
 */

const { getDashboard } = require('../../config/dashboards');
const { buildWeatherDashboardData } = require('./weatherDataBuilder');

/**
 * Build dashboard data based on dashboard configuration
 * @param {string} dashboardId - Dashboard identifier (e.g., 'chripro', 'ro')
 * @param {Object} req - Express request object
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} Dashboard data
 */
async function buildDashboardData(dashboardId, req, logger = console) {
  const dashboardConfig = getDashboard(dashboardId);

  if (!dashboardConfig) {
    throw new Error(`Dashboard '${dashboardId}' not found`);
  }

  logger.info?.(`[DataBuilder] Building data for dashboard: ${dashboardConfig.name}`);

  // Route to appropriate data builder based on dashboard type
  switch (dashboardConfig.type) {
    case 'weather':
      return buildWeatherDashboardData(dashboardConfig, req, logger);

    case 'stocks':
      // TODO: Implement stocks data builder
      throw new Error('Stocks dashboard not yet implemented');

    default:
      throw new Error(`Unknown dashboard type: ${dashboardConfig.type}`);
  }
}

module.exports = {
  buildDashboardData,
};
