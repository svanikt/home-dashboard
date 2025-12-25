const axios = require('axios');
const { BaseService } = require('../lib/BaseService');

/**
 * VedicRishi Astrology Service
 * Uses VedicRishi API (astrologyapi.com) for authentic Vedic astrology calculations
 *
 * API Documentation: https://www.vedicrishiastro.com/docs
 */
class VedicRishiService extends BaseService {
  constructor(cacheTTLMinutes = 1440) { // Default 24 hours
    super({
      name: 'VedicRishi Astrology',
      cacheKey: 'vedicrishi_astrology',
      cacheTTL: cacheTTLMinutes * 60 * 1000,
      retryAttempts: 2,
      retryCooldown: 2000,
    });

    this.apiBase = 'https://api.astrologyapi.com/v1';
    this.userId = process.env.VEDICRISHI_USER_ID;
    this.apiKey = process.env.VEDICRISHI_API_KEY;
  }

  isEnabled() {
    return !!this.userId && !!this.apiKey;
  }

  /**
   * Fetch Vedic astrology data for dashboard
   * @param {Object} config - Birth details and preferences
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Complete Vedic astrology data
   */
  async fetchData(config, logger) {
    const {
      day,
      month,
      year,
      hour,
      minute,
      latitude,
      longitude,
      timezone
    } = config;

    if (!day || !month || !year || !hour || !minute || !latitude || !longitude) {
      throw new Error('Complete birth details required for VedicRishi API');
    }

    logger.info?.('[VedicRishi] Fetching Vedic astrology data');

    // Fetch multiple data points in parallel
    const [panchang, dasha, nakshatraPrediction, birthChart] = await Promise.all([
      this.fetchPanchang(logger),
      this.fetchCurrentDasha({ day, month, year, hour, minute, latitude, longitude, timezone }, logger),
      this.fetchNakshatraPrediction({ day, month, year, hour, minute, latitude, longitude, timezone }, logger),
      this.fetchBirthChartBasics({ day, month, year, hour, minute, latitude, longitude, timezone }, logger),
    ]);

    return {
      panchang,
      dasha,
      nakshatraPrediction,
      birthChart,
    };
  }

  /**
   * Fetch advanced Panchang for today
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Panchang data
   */
  async fetchPanchang(logger) {
    try {
      const now = new Date();
      const requestBody = {
        day: now.getDate(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        hour: now.getHours(),
        min: now.getMinutes(),
        lat: 28.6139, // Default to Delhi, can be made configurable
        lon: 77.2090,
        tzone: 5.5
      };

      logger.info?.('[VedicRishi] Fetching Panchang');

      const response = await axios.post(
        `${this.apiBase}/advanced_panchang`,
        requestBody,
        {
          auth: {
            username: this.userId,
            password: this.apiKey
          },
          timeout: 15000
        }
      );

      return this.parsePanchang(response.data);
    } catch (error) {
      logger.error?.('[VedicRishi] Failed to fetch Panchang:', error.message);
      return null;
    }
  }

  /**
   * Fetch current Vimshottari Dasha periods
   * @param {Object} birthData - Birth details
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Dasha data
   */
  async fetchCurrentDasha(birthData, logger) {
    try {
      const requestBody = {
        day: birthData.day,
        month: birthData.month,
        year: birthData.year,
        hour: birthData.hour,
        min: birthData.minute,
        lat: birthData.latitude,
        lon: birthData.longitude,
        tzone: birthData.timezone || 5.5
      };

      logger.info?.('[VedicRishi] Fetching current Dasha');

      const response = await axios.post(
        `${this.apiBase}/current_vdasha_all`,
        requestBody,
        {
          auth: {
            username: this.userId,
            password: this.apiKey
          },
          timeout: 15000
        }
      );

      return this.parseDasha(response.data);
    } catch (error) {
      logger.error?.('[VedicRishi] Failed to fetch Dasha:', error.message);
      return null;
    }
  }

  /**
   * Fetch daily Nakshatra prediction
   * @param {Object} birthData - Birth details
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Nakshatra prediction
   */
  async fetchNakshatraPrediction(birthData, logger) {
    try {
      const requestBody = {
        day: birthData.day,
        month: birthData.month,
        year: birthData.year,
        hour: birthData.hour,
        min: birthData.minute,
        lat: birthData.latitude,
        lon: birthData.longitude,
        tzone: birthData.timezone || 5.5
      };

      logger.info?.('[VedicRishi] Fetching Nakshatra prediction');

      const response = await axios.post(
        `${this.apiBase}/daily_nakshatra_prediction`,
        requestBody,
        {
          auth: {
            username: this.userId,
            password: this.apiKey
          },
          timeout: 15000
        }
      );

      return this.parseNakshatraPrediction(response.data);
    } catch (error) {
      logger.error?.('[VedicRishi] Failed to fetch Nakshatra prediction:', error.message);
      return null;
    }
  }

  /**
   * Fetch basic birth chart details
   * @param {Object} birthData - Birth details
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Birth chart basics
   */
  async fetchBirthChartBasics(birthData, logger) {
    try {
      const requestBody = {
        day: birthData.day,
        month: birthData.month,
        year: birthData.year,
        hour: birthData.hour,
        min: birthData.minute,
        lat: birthData.latitude,
        lon: birthData.longitude,
        tzone: birthData.timezone || 5.5
      };

      logger.info?.('[VedicRishi] Fetching birth chart basics');

      const response = await axios.post(
        `${this.apiBase}/astro_details`,
        requestBody,
        {
          auth: {
            username: this.userId,
            password: this.apiKey
          },
          timeout: 15000
        }
      );

      return this.parseBirthChart(response.data);
    } catch (error) {
      logger.error?.('[VedicRishi] Failed to fetch birth chart:', error.message);
      return null;
    }
  }

  /**
   * Parse Panchang response
   * @param {Object} data - API response
   * @returns {Object} Parsed Panchang
   */
  parsePanchang(data) {
    if (!data) return null;

    return {
      tithi: data.tithi?.name || 'N/A',
      nakshatra: data.nakshatra?.name || 'N/A',
      yoga: data.yog?.name || 'N/A',
      karana: data.karan?.name || 'N/A',
      vara: data.day || 'N/A',
      rahuKalam: data.rahukaal || 'N/A',
      yamaghanda: data.yamghant || 'N/A',
      gulika: data.gulikai || 'N/A',
    };
  }

  /**
   * Parse Dasha response
   * @param {Object} data - API response
   * @returns {Object} Parsed Dasha
   */
  parseDasha(data) {
    if (!data) return null;

    return {
      mahadasha: data.major_dasha?.planet || 'N/A',
      antardasha: data.antar_dasha?.planet || 'N/A',
      pratyantardasha: data.pratyantar_dasha?.planet || 'N/A',
      mahadashaEnd: data.major_dasha?.end || 'N/A',
    };
  }

  /**
   * Parse Nakshatra prediction response
   * @param {Object} data - API response
   * @returns {Object} Parsed prediction
   */
  parseNakshatraPrediction(data) {
    if (!data || !data.prediction) return null;

    return {
      health: data.prediction.health || '',
      emotions: data.prediction.emotions || '',
      profession: data.prediction.profession || '',
      luck: data.prediction.luck || '',
      personalLife: data.prediction.personal_life || '',
      travel: data.prediction.travel || '',
    };
  }

  /**
   * Parse birth chart response
   * @param {Object} data - API response
   * @returns {Object} Parsed birth chart
   */
  parseBirthChart(data) {
    if (!data) return null;

    return {
      ascendant: data.ascendant || 'N/A',
      moonSign: data.rasi || 'N/A',
      sunSign: data.sign || 'N/A',
      nakshatra: data.nakshatra || 'N/A',
    };
  }

  /**
   * Map raw data to dashboard format
   * @param {Object} apiData - Raw API data
   * @param {Object} config - Configuration
   * @returns {Object} Formatted data
   */
  mapToDashboard(apiData, config) {
    return {
      panchang: apiData.panchang,
      dasha: apiData.dasha,
      prediction: apiData.nakshatraPrediction,
      birthChart: apiData.birthChart,
    };
  }
}

module.exports = { VedicRishiService };
