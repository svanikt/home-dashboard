/**
 * Legacy Data Builder (Backward Compatibility)
 *
 * This file maintains backward compatibility with existing code.
 * New code should use lib/dataBuilders/index.js directly.
 */

const { buildWeatherDashboardData, getServiceStatuses } = require('./dataBuilders/weatherDataBuilder');
const { getDashboard } = require('../config/dashboards');

/**
 * Build dashboard data (defaults to 'chripro' for backward compatibility)
 * @param {Object} req - Express request object
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} Dashboard data
 */
async function buildDashboardData(req, logger = console) {
  const dashboardConfig = getDashboard('chripro');
  return buildWeatherDashboardData(dashboardConfig, req, logger);
}

module.exports = {
  buildDashboardData,
  getServiceStatuses,
};
