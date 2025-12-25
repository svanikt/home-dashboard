const axios = require('axios');
const { BaseService } = require('../lib/BaseService');

/**
 * Prokerala Astrology Service
 * Uses Prokerala API (api.prokerala.com) for Vedic astrology
 *
 * API Documentation: https://api.prokerala.com/docs
 */
class ProkeralaService extends BaseService {
  constructor(cacheTTLMinutes = 1440) { // Default 24 hours
    super({
      name: 'Prokerala Astrology',
      cacheKey: 'prokerala_astrology',
      cacheTTL: cacheTTLMinutes * 60 * 1000,
      retryAttempts: 2,
      retryCooldown: 2000,
    });

    this.apiBase = 'https://api.prokerala.com/v2';
    this.clientId = process.env.PROKERALA_CLIENT_ID;
    this.clientSecret = process.env.PROKERALA_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  isEnabled() {
    return !!this.clientId && !!this.clientSecret;
  }

  /**
   * Get or refresh OAuth2 access token
   * @param {Object} logger - Logger instance
   * @returns {Promise<string>} Access token
   */
  async getAccessToken(logger) {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      logger.info?.('[Prokerala] Fetching new access token');

      const response = await axios.post(
        'https://api.prokerala.com/token',
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

      logger.info?.('[Prokerala] Access token obtained');
      return this.accessToken;
    } catch (error) {
      logger.error?.('[Prokerala] Failed to get access token:', error.message);
      throw new Error('Failed to authenticate with Prokerala API');
    }
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

    if (day == null || month == null || year == null || hour == null || minute == null || latitude == null || longitude == null) {
      throw new Error('Complete birth details required for Prokerala API');
    }

    logger.info?.('[Prokerala] Fetching Vedic astrology data');

    // Get access token
    const token = await this.getAccessToken(logger);

    // Prepare datetime and location for API calls
    // Format timezone offset: 5.5 -> +05:30, -5 -> -05:00
    const tzHours = Math.floor(Math.abs(timezone));
    const tzMinutes = Math.round((Math.abs(timezone) - tzHours) * 60);
    const tzSign = timezone >= 0 ? '+' : '-';
    const tzOffset = `${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`;

    const datetime = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${tzOffset}`;
    const coordinates = `${latitude},${longitude}`;

    // Fetch multiple data points in parallel
    const [panchang, kundli, dailyHoroscope, chart] = await Promise.all([
      this.fetchPanchang(datetime, coordinates, timezone, token, logger),
      this.fetchKundli(datetime, coordinates, timezone, token, logger),
      this.fetchDailyHoroscope(datetime, coordinates, timezone, token, logger),
      this.fetchChart(datetime, coordinates, timezone, token, logger),
    ]);

    return {
      panchang,
      kundli,
      dailyHoroscope,
      chart,
    };
  }

  /**
   * Fetch Panchang for a specific date
   * @param {string} datetime - ISO datetime
   * @param {string} coordinates - lat,lon
   * @param {string} timezone - Timezone identifier
   * @param {string} token - Access token
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Panchang data
   */
  async fetchPanchang(datetime, coordinates, timezone, token, logger) {
    try {
      // Use today's date for Panchang with timezone offset
      const now = new Date();
      const tzHours = Math.floor(Math.abs(timezone));
      const tzMinutes = Math.round((Math.abs(timezone) - tzHours) * 60);
      const tzSign = timezone >= 0 ? '+' : '-';
      const tzOffset = `${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`;
      const todayDatetime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00${tzOffset}`;

      logger.info?.('[Prokerala] Fetching Panchang');

      const response = await axios.get(
        `${this.apiBase}/astrology/panchang`,
        {
          params: {
            ayanamsa: 1, // Lahiri
            coordinates,
            datetime: todayDatetime,
            la: 'en',
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      return this.parsePanchang(response.data);
    } catch (error) {
      logger.error?.('[Prokerala] Failed to fetch Panchang:', error.message);
      if (error.response) {
        logger.error?.('[Prokerala] Panchang error details:', JSON.stringify(error.response.data));
      }
      return null;
    }
  }

  /**
   * Fetch Kundli (birth chart) data
   * @param {string} datetime - ISO datetime
   * @param {string} coordinates - lat,lon
   * @param {string} timezone - Timezone identifier
   * @param {string} token - Access token
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Kundli data
   */
  async fetchKundli(datetime, coordinates, timezone, token, logger) {
    try {
      logger.info?.('[Prokerala] Fetching Kundli');

      const response = await axios.get(
        `${this.apiBase}/astrology/kundli`,
        {
          params: {
            ayanamsa: 1,
            coordinates,
            datetime,
            la: 'en',
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      return this.parseKundli(response.data);
    } catch (error) {
      logger.error?.('[Prokerala] Failed to fetch Kundli:', error.message);
      if (error.response) {
        logger.error?.('[Prokerala] Kundli error details:', JSON.stringify(error.response.data));
      }
      return null;
    }
  }

  /**
   * Fetch daily horoscope prediction
   * @param {string} datetime - ISO datetime
   * @param {string} coordinates - lat,lon
   * @param {string} timezone - Timezone identifier
   * @param {string} token - Access token
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Daily horoscope
   */
  async fetchDailyHoroscope(datetime, coordinates, timezone, token, logger) {
    try {
      // Use today's date for daily horoscope with timezone offset
      const now = new Date();
      const tzHours = Math.floor(Math.abs(timezone));
      const tzMinutes = Math.round((Math.abs(timezone) - tzHours) * 60);
      const tzSign = timezone >= 0 ? '+' : '-';
      const tzOffset = `${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`;
      const todayDatetime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00${tzOffset}`;

      logger.info?.('[Prokerala] Fetching daily horoscope');

      const response = await axios.get(
        `${this.apiBase}/horoscope/daily`,
        {
          params: {
            ayanamsa: 1,
            coordinates,
            datetime: todayDatetime,
            la: 'en',
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      return this.parseDailyHoroscope(response.data);
    } catch (error) {
      logger.error?.('[Prokerala] Failed to fetch daily horoscope:', error.message);
      return null;
    }
  }

  /**
   * Fetch birth chart SVG
   * @param {string} datetime - ISO datetime
   * @param {string} coordinates - lat,lon
   * @param {string} timezone - Timezone identifier
   * @param {string} token - Access token
   * @param {Object} logger - Logger instance
   * @returns {Promise<string>} SVG chart
   */
  async fetchChart(datetime, coordinates, timezone, token, logger) {
    try {
      logger.info?.('[Prokerala] Fetching chart');

      const response = await axios.get(
        `${this.apiBase}/astrology/chart`,
        {
          params: {
            ayanamsa: 1,
            coordinates,
            datetime,
            chart_type: 'rasi', // South Indian style
            chart_style: 'south-indian',
            format: 'svg',
            la: 'en',
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        }
      );

      // API returns SVG directly or in data.svg
      return response.data.svg || response.data || null;
    } catch (error) {
      logger.error?.('[Prokerala] Failed to fetch chart:', error.message);
      return null;
    }
  }

  /**
   * Parse Panchang response
   * @param {Object} data - API response
   * @returns {Object} Parsed Panchang
   */
  parsePanchang(data) {
    if (!data || !data.data) return null;

    const p = data.data;

    return {
      vara: p.nakshatra?.name || p.day || 'N/A',
      tithi: p.tithi?.name || 'N/A',
      nakshatra: p.nakshatra?.name || 'N/A',
      yoga: p.yoga?.name || 'N/A',
      karana: p.karana?.name || 'N/A',
      rahuKalam: p.rahu_kalam ? `${p.rahu_kalam.start} - ${p.rahu_kalam.end}` : 'N/A',
      yamaghanda: p.yamaghanda ? `${p.yamaghanda.start} - ${p.yamaghanda.end}` : 'N/A',
      gulika: p.gulika ? `${p.gulika.start} - ${p.gulika.end}` : 'N/A',
    };
  }

  /**
   * Parse Kundli response
   * @param {Object} data - API response
   * @returns {Object} Parsed Kundli
   */
  parseKundli(data) {
    if (!data || !data.data) return null;

    const k = data.data;

    return {
      ascendant: k.nakshatra_details?.lagna?.sign || 'N/A',
      moonSign: k.nakshatra_details?.chandra_rasi?.sign || 'N/A',
      sunSign: k.nakshatra_details?.surya_rasi?.sign || 'N/A',
      nakshatra: k.nakshatra_details?.nakshatra?.name || 'N/A',
      mangalDosha: k.mangal_dosha?.has_dosha ? 'Present' : 'Absent',
      dasha: this.parseDasha(k.dasha_periods),
    };
  }

  /**
   * Parse Dasha periods
   * @param {Object} dashaPeriods - Dasha data from API
   * @returns {Object} Parsed Dasha
   */
  parseDasha(dashaPeriods) {
    if (!dashaPeriods || !dashaPeriods.major_dasha) return null;

    // Find current dasha period
    const now = new Date();
    const currentMahadasha = dashaPeriods.major_dasha.find(d => {
      const start = new Date(d.start);
      const end = new Date(d.end);
      return now >= start && now <= end;
    });

    if (!currentMahadasha) return null;

    // Find current antardasha
    const currentAntardasha = currentMahadasha.sub_periods?.find(d => {
      const start = new Date(d.start);
      const end = new Date(d.end);
      return now >= start && now <= end;
    });

    return {
      mahadasha: currentMahadasha.planet || 'N/A',
      antardasha: currentAntardasha?.planet || 'N/A',
      mahadashaEnd: currentMahadasha.end || 'N/A',
    };
  }

  /**
   * Parse daily horoscope response
   * @param {Object} data - API response
   * @returns {Object} Parsed horoscope
   */
  parseDailyHoroscope(data) {
    if (!data || !data.data) return null;

    const h = data.data;

    return {
      prediction: h.prediction || h.horoscope || '',
      mood: h.mood || '',
      color: h.lucky_color || '',
      number: h.lucky_number || '',
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
      dasha: apiData.kundli?.dasha,
      birthChart: {
        ascendant: apiData.kundli?.ascendant,
        moonSign: apiData.kundli?.moonSign,
        sunSign: apiData.kundli?.sunSign,
        nakshatra: apiData.kundli?.nakshatra,
        mangalDosha: apiData.kundli?.mangalDosha,
      },
      prediction: {
        text: apiData.dailyHoroscope?.prediction,
        mood: apiData.dailyHoroscope?.mood,
        luckyColor: apiData.dailyHoroscope?.color,
        luckyNumber: apiData.dailyHoroscope?.number,
      },
      chartSvg: apiData.chart,
    };
  }
}

module.exports = { ProkeralaService };
