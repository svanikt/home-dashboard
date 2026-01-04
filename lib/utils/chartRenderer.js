/**
 * North Indian Chart SVG Renderer
 * Generates SVG for North Indian (diamond-shaped) Vedic astrology charts
 */

const { getSignAbbr } = require('./ephemerisUtils');

/**
 * Generate North Indian chart SVG
 * @param {Object} chartData - Chart data with house-to-sign mapping and planets
 * @param {Object} chartData.houseToSign - Mapping of house numbers (1-12) to sign numbers (1-12)
 * @param {Object} chartData.planetsByHouse - Planets grouped by house number
 * @param {Object} chartData.ascendant - Ascendant information
 * @param {Object} options - Rendering options
 * @param {number} options.width - SVG width in pixels (default: 320)
 * @param {number} options.height - SVG height in pixels (default: 320)
 * @returns {string} SVG markup
 */
function generateNorthIndianChartSVG(chartData, options = {}) {
  const { width = 320, height = 320 } = options;
  const padding = width * 0.1;  // 10% padding
  const size = width - (padding * 2);
  const center = width / 2;
  const halfSize = size / 2;

  // Get positions for house numbers and planets
  const positions = getHousePositions(center, halfSize);

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;

  // White background
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;

  // Draw square outline and divisions
  svg += drawSquareChart(center, halfSize);

  // Add house numbers
  for (let house = 1; house <= 12; house++) {
    svg += drawHouseNumber(house, positions.houseNumbers[house]);
  }

  // Add planets for each house
  for (let house = 1; house <= 12; house++) {
    const sign = chartData.houseToSign[house];
    const planets = chartData.planetsByHouse[sign] || [];

    if (planets.length > 0) {
      svg += drawPlanets(planets, positions.planets[house]);
    }
  }

  svg += '</svg>';

  return svg;
}

/**
 * Calculate positions for house numbers and planet content
 * @param {number} center - Center point of SVG
 * @param {number} halfSize - Half the square size
 * @returns {Object} Positions for house numbers and planets
 */
function getHousePositions(center, halfSize) {
  // Positioned exactly per reference image

  return {
    // House numbers - anti-clockwise from 1st house at top
    houseNumbers: {
      // 1st house: Top center (upper diamond section)
      1: { x: center, y: center - halfSize * 0.35 },

      // 2nd house: Upper left small triangle
      2: { x: center - halfSize * 0.3, y: center - halfSize * 0.5 },

      // 3rd house: Upper left corner triangle
      3: { x: center - halfSize * 0.55, y: center - halfSize * 0.3 },

      // 4th house: Left center (left diamond section)
      4: { x: center - halfSize * 0.55, y: center },

      // 5th house: Lower left corner triangle
      5: { x: center - halfSize * 0.55, y: center + halfSize * 0.3 },

      // 6th house: Lower left small triangle
      6: { x: center - halfSize * 0.3, y: center + halfSize * 0.5 },

      // 7th house: Bottom center (lower diamond section)
      7: { x: center, y: center + halfSize * 0.5 },

      // 8th house: Lower right small triangle
      8: { x: center + halfSize * 0.3, y: center + halfSize * 0.5 },

      // 9th house: Lower right corner triangle
      9: { x: center + halfSize * 0.55, y: center + halfSize * 0.3 },

      // 10th house: Right center (right diamond section)
      10: { x: center + halfSize * 0.55, y: center },

      // 11th house: Upper right corner triangle
      11: { x: center + halfSize * 0.55, y: center - halfSize * 0.3 },

      // 12th house: Upper right small triangle
      12: { x: center + halfSize * 0.3, y: center - halfSize * 0.5 }
    },

    // Planet positions - in open spaces matching house sections
    planets: {
      // 1st house: Top diamond section
      1: { x: center, y: center - halfSize * 0.65 },

      // 2nd house: Upper left small triangle
      2: { x: center - halfSize * 0.35, y: center - halfSize * 0.6 },

      // 3rd house: Upper left corner triangle
      3: { x: center - halfSize * 0.68, y: center - halfSize * 0.5 },

      // 4th house: Left diamond section
      4: { x: center - halfSize * 0.68, y: center },

      // 5th house: Lower left corner triangle
      5: { x: center - halfSize * 0.68, y: center + halfSize * 0.5 },

      // 6th house: Lower left small triangle
      6: { x: center - halfSize * 0.35, y: center + halfSize * 0.6 },

      // 7th house: Bottom diamond section
      7: { x: center, y: center + halfSize * 0.65 },

      // 8th house: Lower right small triangle
      8: { x: center + halfSize * 0.35, y: center + halfSize * 0.6 },

      // 9th house: Lower right corner triangle
      9: { x: center + halfSize * 0.68, y: center + halfSize * 0.5 },

      // 10th house: Right diamond section
      10: { x: center + halfSize * 0.68, y: center },

      // 11th house: Upper right corner triangle
      11: { x: center + halfSize * 0.68, y: center - halfSize * 0.5 },

      // 12th house: Upper right small triangle
      12: { x: center + halfSize * 0.35, y: center - halfSize * 0.6 }
    }
  };
}

/**
 * Draw North Indian chart structure
 * @param {number} center - Center point
 * @param {number} halfSize - Half the square size
 * @returns {string} SVG elements for chart structure
 */
function drawSquareChart(center, halfSize) {
  const top = center - halfSize;
  const bottom = center + halfSize;
  const left = center - halfSize;
  const right = center + halfSize;

  let svg = '';

  // 1. Outer bounding box (square)
  svg += `<rect x="${left}" y="${top}" width="${halfSize * 2}" height="${halfSize * 2}"
    fill="white" stroke="black" stroke-width="3"/>`;

  // 2. Cross rotated 45 degrees (full corner-to-corner diagonals)
  // Top-left to bottom-right
  svg += `<line x1="${left}" y1="${top}" x2="${right}" y2="${bottom}"
    stroke="black" stroke-width="2.5"/>`;
  // Top-right to bottom-left
  svg += `<line x1="${right}" y1="${top}" x2="${left}" y2="${bottom}"
    stroke="black" stroke-width="2.5"/>`;

  // 3. Rotated square (diamond connecting midpoints of bounding box)
  // Top midpoint to right midpoint
  svg += `<line x1="${center}" y1="${top}" x2="${right}" y2="${center}"
    stroke="black" stroke-width="2.5"/>`;
  // Right midpoint to bottom midpoint
  svg += `<line x1="${right}" y1="${center}" x2="${center}" y2="${bottom}"
    stroke="black" stroke-width="2.5"/>`;
  // Bottom midpoint to left midpoint
  svg += `<line x1="${center}" y1="${bottom}" x2="${left}" y2="${center}"
    stroke="black" stroke-width="2.5"/>`;
  // Left midpoint to top midpoint
  svg += `<line x1="${left}" y1="${center}" x2="${center}" y2="${top}"
    stroke="black" stroke-width="2.5"/>`;

  return svg;
}

/**
 * Draw house number
 * @param {number} houseNum - House number (1-12)
 * @param {Object} position - Position {x, y}
 * @returns {string} SVG text element
 */
function drawHouseNumber(houseNum, position) {
  return `<text x="${position.x}" y="${position.y}"
    font-size="16"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    fill="#aaa">${houseNum}</text>`;
}

/**
 * Draw planets in a house
 * @param {Array} planets - Array of planet abbreviations
 * @param {Object} position - Position {x, y}
 * @returns {string} SVG text element
 */
function drawPlanets(planets, position) {
  const planetText = planets.join(' ');
  return `<text x="${position.x}" y="${position.y}"
    font-size="32"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    font-weight="bold"
    fill="#000">${planetText}</text>`;
}

module.exports = {
  generateNorthIndianChartSVG
};
