/**
 * Vedic Chart Service
 * Generates North Indian Jyotish charts using Swiss Ephemeris
 */

const path = require('path');
const fs = require('fs');
const {
  longitudeToSign,
  validateBirthDetails,
  calculateKetuPosition,
  getPlanetAbbr
} = require('../lib/utils/ephemerisUtils');
const { generateNorthIndianChartSVG } = require('../lib/utils/chartRenderer');

class VedicChartService {
  constructor() {
    this.enabled = false;
    this.sweph = null;
    this.initialize();
  }

  /**
   * Initialize Swiss Ephemeris
   */
  initialize() {
    try {
      // Require sweph
      this.sweph = require('sweph');

      // Set ephemeris path
      const ephePath = path.join(__dirname, '../data/ephemeris');

      // Check if ephemeris directory exists
      if (!fs.existsSync(ephePath)) {
        console.error('[VedicChartService] Ephemeris directory not found:', ephePath);
        console.error('[VedicChartService] Please download Swiss Ephemeris files:');
        console.error('[VedicChartService] 1. Create directory: mkdir -p', ephePath);
        console.error('[VedicChartService] 2. Download from: https://www.astro.com/ftp/swisseph/ephe/');
        console.error('[VedicChartService] 3. Required files: seas_18.se1, semo_18.se1, sepl_18.se1');
        this.enabled = false;
        return;
      }

      // Set ephemeris path (sweph uses simplified API without swe_ prefix)
      this.sweph.set_ephe_path(ephePath);

      // Set Lahiri ayanamsa (standard in Vedic astrology)
      // SE_SIDM_LAHIRI = 1
      this.sweph.set_sid_mode(1, 0, 0);

      this.enabled = true;
      console.log('[VedicChartService] Initialized successfully with Lahiri ayanamsa');
    } catch (error) {
      console.error('[VedicChartService] Initialization failed:', error.message);
      console.error('[VedicChartService] Swiss Ephemeris will not be available');
      this.enabled = false;
    }
  }

  /**
   * Generate birth chart
   * @param {Object} birthDetails - Birth details
   * @param {Object} logger - Logger instance
   * @returns {string|null} SVG chart or null on error
   */
  generateChart(birthDetails, logger) {
    if (!this.enabled) {
      logger.error?.('[VedicChartService] Service not initialized');
      return null;
    }

    try {
      // Validate birth details
      const validation = validateBirthDetails(birthDetails);
      if (!validation.valid) {
        logger.error?.('[VedicChartService] Invalid birth details:', validation.errors.join(', '));
        return null;
      }

      logger.info?.('[VedicChartService] Generating chart for:', {
        date: `${birthDetails.year}-${birthDetails.month}-${birthDetails.day}`,
        time: `${birthDetails.hour}:${birthDetails.minute}`,
        location: `${birthDetails.latitude}, ${birthDetails.longitude}`
      });

      // Calculate Julian Day
      const jd = this.calculateJulianDay(birthDetails);
      logger.debug?.('[VedicChartService] Julian Day:', jd);

      // Calculate planetary positions
      const planets = this.calculatePlanetaryPositions(jd, logger);

      // Calculate ascendant and houses
      const ascendant = this.calculateAscendant(
        jd,
        birthDetails.latitude,
        birthDetails.longitude,
        logger
      );

      // Map houses to signs (based on ascendant)
      const houseToSign = this.calculateHouseToSign(ascendant);

      // Group planets by sign (which determines house in North Indian chart)
      const planetsByHouse = this.groupPlanetsBySign(planets, ascendant);

      // Prepare chart data
      const chartData = {
        houseToSign,
        planetsByHouse,
        ascendant
      };

      logger.info?.('[VedicChartService] Chart data prepared:', {
        ascendantSign: ascendant.sign,
        planetCount: planets.length
      });

      // Generate SVG
      const svg = generateNorthIndianChartSVG(chartData, { width: 320, height: 320 });

      logger.info?.('[VedicChartService] Chart generated successfully');
      return svg;
    } catch (error) {
      logger.error?.('[VedicChartService] Error generating chart:', error.message);
      logger.error?.('[VedicChartService] Stack:', error.stack);
      return null;
    }
  }

  /**
   * Calculate Julian Day from birth details
   * @param {Object} birthDetails - Birth details
   * @returns {number} Julian Day number
   */
  calculateJulianDay(birthDetails) {
    const { year, month, day, hour, minute, timezone } = birthDetails;

    // Convert to Universal Time (UT)
    const utHour = hour + (minute / 60.0) - timezone;

    // Calculate Julian Day
    // SE_GREG_CAL = 1 (Gregorian calendar)
    return this.sweph.julday(
      year,
      month,
      day,
      utHour,
      1
    );
  }

  /**
   * Calculate planetary positions
   * @param {number} jd - Julian Day
   * @param {Object} logger - Logger instance
   * @returns {Array} Array of planet objects with positions
   */
  calculatePlanetaryPositions(jd, logger) {
    // Planet IDs: Sun=0, Moon=1, Mercury=2, Venus=3, Mars=4, Jupiter=5, Saturn=6, Mean Node=10
    const planetDefs = [
      { id: 0, name: 'Sun' },
      { id: 1, name: 'Moon' },
      { id: 4, name: 'Mars' },
      { id: 2, name: 'Mercury' },
      { id: 5, name: 'Jupiter' },
      { id: 3, name: 'Venus' },
      { id: 6, name: 'Saturn' },
      { id: 10, name: 'Rahu' }
    ];

    // SEFLG_SIDEREAL = 65536, SEFLG_SPEED = 256
    const flags = 65536 | 256; // Sidereal + Speed

    const planets = planetDefs.map(planet => {
      const result = this.sweph.calc_ut(
        jd,
        planet.id,
        flags
      );

      if (result.error) {
        logger.warn?.(`[VedicChartService] Error calculating ${planet.name}:`, result.error);
        return null;
      }

      const longitude = result.longitude;
      const sign = longitudeToSign(longitude);
      const abbr = getPlanetAbbr(planet.name);

      logger.debug?.(`[VedicChartService] ${planet.name} (${abbr}): ${longitude.toFixed(2)}° in ${sign}`);

      return {
        name: planet.name,
        abbr: abbr,
        longitude: longitude,
        sign: sign
      };
    }).filter(p => p !== null);

    // Calculate Ketu (opposite of Rahu)
    const rahu = planets.find(p => p.name === 'Rahu');
    if (rahu) {
      const ketuLongitude = calculateKetuPosition(rahu.longitude);
      const ketuSign = longitudeToSign(ketuLongitude);

      planets.push({
        name: 'Ketu',
        abbr: 'Ke',
        longitude: ketuLongitude,
        sign: ketuSign
      });

      logger.debug?.(`[VedicChartService] Ketu (Ke): ${ketuLongitude.toFixed(2)}° in ${ketuSign}`);
    }

    return planets;
  }

  /**
   * Calculate ascendant (Lagna)
   * @param {number} jd - Julian Day
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {Object} logger - Logger instance
   * @returns {Object} Ascendant information
   */
  calculateAscendant(jd, latitude, longitude, logger) {
    // Calculate houses using Placidus system ('P')
    // Alternative: 'W' for Whole Sign houses (traditional Vedic)
    const houses = this.sweph.houses(jd, latitude, longitude, 'W');

    const ascendantLongitude = houses.ascendant;
    const ascendantSign = longitudeToSign(ascendantLongitude);

    logger.debug?.(`[VedicChartService] Ascendant: ${ascendantLongitude.toFixed(2)}° in sign ${ascendantSign}`);

    return {
      longitude: ascendantLongitude,
      sign: ascendantSign
    };
  }

  /**
   * Calculate house-to-sign mapping
   * In North Indian chart, signs are placed in houses based on ascendant
   * @param {Object} ascendant - Ascendant information
   * @returns {Object} Mapping of house numbers to sign numbers
   */
  calculateHouseToSign(ascendant) {
    const houseToSign = {};

    // House 1 contains the ascendant sign
    // Subsequent houses contain subsequent signs (counter-clockwise)
    for (let house = 1; house <= 12; house++) {
      houseToSign[house] = ((ascendant.sign + house - 2) % 12) + 1;
    }

    return houseToSign;
  }

  /**
   * Group planets by sign
   * In North Indian chart, planets are displayed in houses based on their sign
   * @param {Array} planets - Array of planet objects
   * @param {Object} ascendant - Ascendant information
   * @returns {Object} Planets grouped by sign number
   */
  groupPlanetsBySign(planets, ascendant) {
    const planetsBySign = {};

    // Add ascendant marker to ascendant sign
    const ascSign = ascendant.sign;
    planetsBySign[ascSign] = ['As'];

    // Group planets by their sign
    planets.forEach(planet => {
      if (!planetsBySign[planet.sign]) {
        planetsBySign[planet.sign] = [];
      }
      planetsBySign[planet.sign].push(planet.abbr);
    });

    return planetsBySign;
  }
}

// Export singleton instance
module.exports = new VedicChartService();
