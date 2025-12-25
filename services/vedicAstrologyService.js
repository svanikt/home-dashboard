const axios = require('axios');
const { BaseService } = require('../lib/BaseService');

/**
 * Vedic Astrology Service - Fetches Jyotish data from VedAstro API
 * Uses VedAstro.org free API for daily predictions, planetary positions, and Dasha periods
 *
 * API Documentation: https://vedastro.org/APIBuilder.html
 */
class VedicAstrologyService extends BaseService {
  constructor(cacheTTLMinutes = 1440) { // Default 24 hours
    super({
      name: 'Vedic Astrology',
      cacheKey: 'vedic_astrology',
      cacheTTL: cacheTTLMinutes * 60 * 1000,
      retryAttempts: 2,
      retryCooldown: 2000,
    });
    this.apiBase = 'http://api.vedastro.org/api/Calculate';
    this.apiKey = process.env.VEDASTRO_API_KEY || 'FreeAPIUser'; // Use free tier
  }

  isEnabled() {
    // VedAstro API is free and doesn't require API key
    return true;
  }

  /**
   * Fetch Vedic astrology data
   * @param {Object} config - { birthTime, birthLocation }
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Vedic astrology data
   */
  async fetchData(config, logger) {
    const { birthTime, birthLocation } = config;

    if (!birthTime || !birthLocation) {
      throw new Error('Birth time and location required for Vedic astrology');
    }

    logger.info?.(`[Vedic Astrology] Fetching data for birth: ${birthTime} at ${birthLocation}`);

    // Fetch horoscope predictions
    const predictions = await this.fetchHoroscopePredictions(birthTime, birthLocation, logger);

    // Fetch current planetary positions (for today)
    const currentTime = this.formatCurrentTime();
    const planets = await this.fetchPlanetData(currentTime, birthLocation, logger);

    // Fetch current Dasha period
    const dasha = await this.fetchCurrentDasha(birthTime, birthLocation, logger);

    return {
      predictions: predictions || [],
      planets: planets || {},
      dasha: dasha || null,
      birthTime,
      birthLocation,
    };
  }

  /**
   * Format current time for VedAstro API
   * Format: HH:MM/DD/MM/YYYY/TIMEZONE
   * @returns {string} Formatted time string
   */
  formatCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    // Use UTC offset
    const offset = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const offsetSign = offset >= 0 ? '+' : '-';
    const timezone = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    return `${hours}:${minutes}/${day}/${month}/${year}/${timezone}`;
  }

  /**
   * Fetch horoscope predictions based on birth chart
   * @param {string} birthTime - Format: HH:MM/DD/MM/YYYY/TIMEZONE
   * @param {string} birthLocation - Format: latitude,longitude
   * @param {Object} logger - Logger instance
   * @returns {Promise<Array>} Array of predictions
   */
  async fetchHoroscopePredictions(birthTime, birthLocation, logger) {
    try {
      const url = `${this.apiBase}/HoroscopePredictions/Location/${birthLocation}/Time/${birthTime}/APIKey/${this.apiKey}`;

      logger.info?.(`[Vedic Astrology] Fetching predictions from: ${url}`);

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VedicDashboard/1.0)',
        },
      });

      // VedAstro returns XML, parse it
      const predictions = this.parseHoroscopePredictions(response.data);

      logger.info?.(`[Vedic Astrology] Found ${predictions.length} predictions`);

      return predictions;
    } catch (error) {
      logger.error?.(`[Vedic Astrology] Failed to fetch predictions:`, error.message);
      return [];
    }
  }

  /**
   * Fetch planetary positions for current time
   * @param {string} time - Format: HH:MM/DD/MM/YYYY/TIMEZONE
   * @param {string} location - Format: latitude,longitude
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Planetary positions
   */
  async fetchPlanetData(time, location, logger) {
    try {
      // Get data for all planets
      const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
      const planetData = {};

      // Fetch in parallel
      const promises = planets.map(async (planet) => {
        try {
          const url = `${this.apiBase}/PlanetZodiacSign/PlanetName/${planet}/Location/${location}/Time/${time}/APIKey/${this.apiKey}`;
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; VedicDashboard/1.0)',
            },
          });

          planetData[planet] = this.parsePlanetData(response.data);
        } catch (error) {
          logger.warn?.(`[Vedic Astrology] Failed to fetch ${planet}:`, error.message);
        }
      });

      await Promise.all(promises);

      logger.info?.(`[Vedic Astrology] Fetched data for ${Object.keys(planetData).length} planets`);

      return planetData;
    } catch (error) {
      logger.error?.(`[Vedic Astrology] Failed to fetch planet data:`, error.message);
      return {};
    }
  }

  /**
   * Fetch current Dasha period
   * @param {string} birthTime - Format: HH:MM/DD/MM/YYYY/TIMEZONE
   * @param {string} birthLocation - Format: latitude,longitude
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object|null>} Current Dasha data
   */
  async fetchCurrentDasha(birthTime, birthLocation, logger) {
    try {
      const now = new Date();
      const currentTime = this.formatCurrentTime();

      const url = `${this.apiBase}/CurrentDasa8Levels/Location/${birthLocation}/Time/${birthTime}/TimeNow/${currentTime}/APIKey/${this.apiKey}`;

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VedicDashboard/1.0)',
        },
      });

      const dasha = this.parseDashaData(response.data);

      logger.info?.(`[Vedic Astrology] Current Dasha: ${dasha?.planet || 'Unknown'}`);

      return dasha;
    } catch (error) {
      logger.error?.(`[Vedic Astrology] Failed to fetch Dasha:`, error.message);
      return null;
    }
  }


  /**
   * Parse horoscope predictions from JSON response
   * @param {Object} data - JSON response from VedAstro API
   * @returns {Array} Parsed predictions
   */
  parseHoroscopePredictions(data) {
    const predictions = [];

    try {
      // VedAstro returns JSON with structure: {Status: ..., Payload: [...]}
      if (data && data.Payload && Array.isArray(data.Payload)) {
        data.Payload.forEach(prediction => {
          if (prediction.Name) {
            predictions.push({
              text: prediction.Name,
              category: this.categorizePrediction(prediction.Name),
            });
          }
        });
      }
    } catch (error) {
      console.error('[Vedic Astrology] Error parsing predictions:', error.message);
    }

    return predictions.slice(0, 5); // Limit to 5 predictions
  }

  /**
   * Categorize prediction type
   * @param {string} text - Prediction text
   * @returns {string} Category
   */
  categorizePrediction(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('wealth') || lowerText.includes('money') || lowerText.includes('financial')) {
      return 'financial';
    }
    if (lowerText.includes('health') || lowerText.includes('body')) {
      return 'health';
    }
    if (lowerText.includes('relationship') || lowerText.includes('marriage') || lowerText.includes('love')) {
      return 'relationship';
    }
    return 'general';
  }

  /**
   * Parse planet data from JSON response
   * @param {Object} data - JSON response from VedAstro API
   * @returns {Object} Parsed planet data
   */
  parsePlanetData(data) {
    const planetInfo = {};

    try {
      // VedAstro returns {Status: ..., Payload: {Name: "Aries", ...}}
      if (data && data.Payload) {
        planetInfo.sign = data.Payload.Name || data.Payload;
      }
    } catch (error) {
      console.error('[Vedic Astrology] Error parsing planet data:', error.message);
    }

    return planetInfo;
  }

  /**
   * Parse Dasha data from JSON response
   * @param {Object} data - JSON response from VedAstro API
   * @returns {Object|null} Parsed Dasha data
   */
  parseDashaData(data) {
    try {
      // VedAstro returns {Status: ..., Payload: [...]}
      if (data && data.Payload && Array.isArray(data.Payload) && data.Payload.length > 0) {
        const firstDasha = data.Payload[0];
        return {
          planet: firstDasha.Name || firstDasha.PlanetName || 'Unknown',
          endsOn: firstDasha.EndTime || 'Unknown',
        };
      }
    } catch (error) {
      console.error('[Vedic Astrology] Error parsing Dasha:', error.message);
    }

    return null;
  }

  /**
   * Map raw data to dashboard format
   * @param {Object} apiData - Raw API data
   * @param {Object} config - Configuration
   * @returns {Object} Formatted data
   */
  mapToDashboard(apiData, config) {
    return {
      predictions: (apiData.predictions || []).map(p => ({
        text: p.text,
        category: p.category,
      })),
      currentDasha: apiData.dasha ? {
        planet: apiData.dasha.planet,
        endsOn: apiData.dasha.endsOn,
      } : null,
      planets: apiData.planets || {},
    };
  }
}

module.exports = { VedicAstrologyService };
