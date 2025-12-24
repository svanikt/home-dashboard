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
    this.apiBase = 'https://api.vedastro.org';
    this.apiKey = process.env.VEDASTRO_API_KEY || ''; // Optional
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
      const url = `${this.apiBase}/Calculate/HoroscopePrediction/PlanetName/All/HouseName/All/Time/${birthTime}/Location/${birthLocation}`;

      logger.info?.(`[Vedic Astrology] Fetching predictions from: ${url}`);

      const response = await axios.get(url, {
        timeout: 15000,
        headers: this.getHeaders(),
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
          const url = `${this.apiBase}/Calculate/PlanetName/${planet}/Time/${time}/Location/${location}`;
          const response = await axios.get(url, {
            timeout: 10000,
            headers: this.getHeaders(),
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
      const endDate = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate()); // 5 years ahead

      const currentTime = this.formatCurrentTime();
      const endTime = this.formatDate(endDate);

      const url = `${this.apiBase}/Calculate/DasaPeriod/BirthTime/${birthTime}/BirthLocation/${birthLocation}/StartTime/${currentTime}/StartLocation/${birthLocation}/EndTime/${endTime}/EndLocation/${birthLocation}/DasaLevel/3`;

      const response = await axios.get(url, {
        timeout: 15000,
        headers: this.getHeaders(),
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
   * Format date for API
   * @param {Date} date - Date object
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const offset = -date.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMinutes = Math.abs(offset) % 60;
    const offsetSign = offset >= 0 ? '+' : '-';
    const timezone = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    return `${hours}:${minutes}/${day}/${month}/${year}/${timezone}`;
  }

  /**
   * Get request headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; VedicDashboard/1.0)',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Parse horoscope predictions from XML response
   * @param {string} xmlData - XML response
   * @returns {Array} Parsed predictions
   */
  parseHoroscopePredictions(xmlData) {
    // Basic XML parsing - look for prediction text
    // VedAstro returns predictions in XML format
    const predictions = [];

    try {
      // Extract prediction text from XML (basic regex parsing)
      const predictionRegex = /<Name>(.*?)<\/Name>/g;
      let match;

      while ((match = predictionRegex.exec(xmlData)) !== null) {
        const text = match[1].trim();
        if (text && text.length > 10) {
          predictions.push({
            text,
            category: this.categorizePrediction(text),
          });
        }
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
   * Parse planet data from XML response
   * @param {string} xmlData - XML response
   * @returns {Object} Parsed planet data
   */
  parsePlanetData(xmlData) {
    // Extract zodiac sign and degree
    const data = {};

    try {
      const signMatch = xmlData.match(/<ZodiacSignName>(.*?)<\/ZodiacSignName>/);
      const degreeMatch = xmlData.match(/<Degrees>(.*?)<\/Degrees>/);

      if (signMatch) data.sign = signMatch[1];
      if (degreeMatch) data.degree = parseFloat(degreeMatch[1]);
    } catch (error) {
      console.error('[Vedic Astrology] Error parsing planet data:', error.message);
    }

    return data;
  }

  /**
   * Parse Dasha data from XML response
   * @param {string} xmlData - XML response
   * @returns {Object|null} Parsed Dasha data
   */
  parseDashaData(xmlData) {
    try {
      // Extract first Dasha period
      const planetMatch = xmlData.match(/<Name>(.*?)<\/Name>/);
      const startMatch = xmlData.match(/<StartTime>(.*?)<\/StartTime>/);
      const endMatch = xmlData.match(/<EndTime>(.*?)<\/EndTime>/);

      if (planetMatch && endMatch) {
        return {
          planet: planetMatch[1],
          endsOn: endMatch[1],
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
