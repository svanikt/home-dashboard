/**
 * Dashboard Configuration
 * Defines all available dashboards and their settings
 */

const dashboards = {
  chripro: {
    id: 'chripro',
    name: 'Chripro Weather Dashboard',
    type: 'weather',
    description: 'E-ink weather display for home',
    display: {
      width: 800,
      height: 480,
    },
    services: {
      weather: {
        enabled: true,
        zip: process.env.CHRIPRO_LOCATION_ZIP || process.env.MAIN_LOCATION_ZIP,
        additionalZips: process.env.CHRIPRO_ADDITIONAL_LOCATION_ZIPS || process.env.ADDITIONAL_LOCATION_ZIPS,
      },
      calendar: {
        enabled: true,
        authFile: 'auth-chripro.json',
      },
      llm: {
        enabled: true,
        provider: 'gemini', // or 'anthropic'
      },
      ambient: {
        enabled: true,
      },
      vehicles: {
        enabled: false,
      },
      message: {
        enabled: true,
      },
    },
    template: 'dashboard-weather',
  },

  ro: {
    id: 'ro',
    name: 'Ro Stock Dashboard',
    type: 'stocks',
    description: 'E-ink stock tracker for dad',
    display: {
      width: 800,
      height: 480,
    },
    services: {
      stocks: {
        enabled: true,
        symbols: (process.env.RO_STOCK_SYMBOLS || 'AAPL,GOOGL,MSFT,TSLA').split(','),
        refreshInterval: 60, // seconds
      },
      calendar: {
        enabled: false,
        authFile: 'auth-ro.json',
      },
      message: {
        enabled: false,
      },
    },
    template: 'dashboard-stocks',
  },
};

/**
 * Get dashboard configuration by ID
 * @param {string} dashboardId - Dashboard identifier
 * @returns {Object|null} Dashboard config or null if not found
 */
function getDashboard(dashboardId) {
  return dashboards[dashboardId] || null;
}

/**
 * Get all dashboard IDs
 * @returns {string[]} Array of dashboard IDs
 */
function getDashboardIds() {
  return Object.keys(dashboards);
}

/**
 * Check if dashboard exists
 * @param {string} dashboardId - Dashboard identifier
 * @returns {boolean} True if dashboard exists
 */
function dashboardExists(dashboardId) {
  return dashboardId in dashboards;
}

/**
 * Get all dashboards
 * @returns {Object} All dashboard configurations
 */
function getAllDashboards() {
  return dashboards;
}

module.exports = {
  getDashboard,
  getDashboardIds,
  dashboardExists,
  getAllDashboards,
};
