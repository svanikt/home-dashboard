/**
 * Ephemeris Utilities
 * Helper functions for Vedic astrology calculations using Swiss Ephemeris
 */

// Zodiac sign abbreviations (1-12)
const SIGN_ABBR = [
  'Ar',  // 1 - Aries (Mesha)
  'Ta',  // 2 - Taurus (Vrishabha)
  'Ge',  // 3 - Gemini (Mithuna)
  'Cn',  // 4 - Cancer (Karka)
  'Le',  // 5 - Leo (Simha)
  'Vi',  // 6 - Virgo (Kanya)
  'Li',  // 7 - Libra (Tula)
  'Sc',  // 8 - Scorpio (Vrishchika)
  'Sg',  // 9 - Sagittarius (Dhanu)
  'Cp',  // 10 - Capricorn (Makara)
  'Aq',  // 11 - Aquarius (Kumbha)
  'Pi'   // 12 - Pisces (Meena)
];

// Full zodiac sign names
const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

// Planet abbreviations
const PLANET_ABBR = {
  Sun: 'Su',
  Moon: 'Mo',
  Mars: 'Ma',
  Mercury: 'Me',
  Jupiter: 'Ju',
  Venus: 'Ve',
  Saturn: 'Sa',
  Rahu: 'Ra',
  Ketu: 'Ke'
};

/**
 * Get zodiac sign abbreviation from sign number
 * @param {number} signNumber - Sign number (1-12)
 * @returns {string} Sign abbreviation
 */
function getSignAbbr(signNumber) {
  if (signNumber < 1 || signNumber > 12) {
    throw new Error(`Invalid sign number: ${signNumber}. Must be between 1 and 12.`);
  }
  return SIGN_ABBR[signNumber - 1];
}

/**
 * Get full zodiac sign name from sign number
 * @param {number} signNumber - Sign number (1-12)
 * @returns {string} Sign name
 */
function getSignName(signNumber) {
  if (signNumber < 1 || signNumber > 12) {
    throw new Error(`Invalid sign number: ${signNumber}. Must be between 1 and 12.`);
  }
  return SIGN_NAMES[signNumber - 1];
}

/**
 * Calculate zodiac sign from longitude
 * @param {number} longitude - Longitude in degrees (0-360)
 * @returns {number} Sign number (1-12)
 */
function longitudeToSign(longitude) {
  // Normalize longitude to 0-360 range
  const normalizedLongitude = ((longitude % 360) + 360) % 360;
  return Math.floor(normalizedLongitude / 30) + 1;
}

/**
 * Get planet abbreviation
 * @param {string} planetName - Planet name
 * @returns {string} Planet abbreviation
 */
function getPlanetAbbr(planetName) {
  return PLANET_ABBR[planetName] || planetName.substring(0, 2);
}

/**
 * Validate birth details
 * @param {Object} details - Birth details object
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
function validateBirthDetails(details) {
  const errors = [];

  // Check required fields
  if (details.year == null) errors.push('Year is required');
  if (details.month == null) errors.push('Month is required');
  if (details.day == null) errors.push('Day is required');
  if (details.hour == null) errors.push('Hour is required');
  if (details.minute == null) errors.push('Minute is required');
  if (details.latitude == null) errors.push('Latitude is required');
  if (details.longitude == null) errors.push('Longitude is required');
  if (details.timezone == null) errors.push('Timezone is required');

  // Validate ranges
  if (details.year && (details.year < 1800 || details.year > 2399)) {
    errors.push('Year must be between 1800 and 2399 (ephemeris data range)');
  }

  if (details.month && (details.month < 1 || details.month > 12)) {
    errors.push('Month must be between 1 and 12');
  }

  if (details.day && (details.day < 1 || details.day > 31)) {
    errors.push('Day must be between 1 and 31');
  }

  if (details.hour != null && (details.hour < 0 || details.hour > 23)) {
    errors.push('Hour must be between 0 and 23');
  }

  if (details.minute != null && (details.minute < 0 || details.minute > 59)) {
    errors.push('Minute must be between 0 and 59');
  }

  if (details.latitude != null && (details.latitude < -90 || details.latitude > 90)) {
    errors.push('Latitude must be between -90 and 90');
  }

  if (details.longitude != null && (details.longitude < -180 || details.longitude > 180)) {
    errors.push('Longitude must be between -180 and 180');
  }

  if (details.timezone != null && (details.timezone < -12 || details.timezone > 14)) {
    errors.push('Timezone must be between -12 and +14');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate degree position within sign
 * @param {number} longitude - Longitude in degrees
 * @returns {number} Degrees within sign (0-30)
 */
function degreesInSign(longitude) {
  const normalizedLongitude = ((longitude % 360) + 360) % 360;
  return normalizedLongitude % 30;
}

/**
 * Format degree position as degrees, minutes, seconds
 * @param {number} longitude - Longitude in degrees
 * @returns {string} Formatted position (e.g., "15° 23' 45\"")
 */
function formatDegrees(longitude) {
  const degrees = Math.floor(longitude);
  const minutes = Math.floor((longitude - degrees) * 60);
  const seconds = Math.floor(((longitude - degrees) * 60 - minutes) * 60);

  return `${degrees}° ${minutes}' ${seconds}"`;
}

/**
 * Calculate Ketu position (opposite of Rahu)
 * @param {number} rahuLongitude - Rahu's longitude in degrees
 * @returns {number} Ketu's longitude in degrees
 */
function calculateKetuPosition(rahuLongitude) {
  return (rahuLongitude + 180) % 360;
}

module.exports = {
  SIGN_ABBR,
  SIGN_NAMES,
  PLANET_ABBR,
  getSignAbbr,
  getSignName,
  longitudeToSign,
  getPlanetAbbr,
  validateBirthDetails,
  degreesInSign,
  formatDegrees,
  calculateKetuPosition
};
