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
  const outerOffset = halfSize * 0.7;   // For outer cardinal sections
  const innerOffset = halfSize * 0.4;   // For inner sections
  const numOffset = halfSize * 0.15;    // Small offset for house numbers at center intersections

  return {
    // House numbers at center intersection points (matching reference image)
    houseNumbers: {
      12: { x: center + numOffset, y: center - numOffset - 3 },       // Top-right of center
      1: { x: center + numOffset, y: center + numOffset + 3 },        // Bottom-right of center
      2: { x: center, y: center - numOffset - 8 },                    // Top of center
      11: { x: center, y: center - numOffset + 3 },                   // Top of center (above 2)
      3: { x: center - numOffset - 3, y: center - numOffset },        // Top-left of center
      4: { x: center - numOffset - 3, y: center },                    // Left of center
      5: { x: center - numOffset, y: center + numOffset + 3 },        // Bottom-left of center (top)
      6: { x: center - numOffset, y: center + numOffset + 8 },        // Bottom-left of center (bottom)
      7: { x: center - numOffset, y: center + numOffset + 13 },       // Left-bottom
      8: { x: center, y: center + numOffset + 8 },                    // Bottom of center
      9: { x: center + numOffset + 3, y: center + numOffset },        // Bottom-right area
      10: { x: center + numOffset + 8, y: center + numOffset }        // Right-bottom area
    },

    // Planet positions in clear open areas (matching reference image layout)
    planets: {
      1: { x: center + outerOffset, y: center + outerOffset * 0.5 },      // Right section
      2: { x: center + innerOffset, y: center - outerOffset * 0.4 },      // Top-right
      3: { x: center + innerOffset, y: center - innerOffset },            // Right-top
      4: { x: center, y: center - outerOffset * 0.6 },                    // Top section
      5: { x: center - innerOffset, y: center - innerOffset },            // Left-top
      6: { x: center - innerOffset, y: center - outerOffset * 0.4 },      // Top-left
      7: { x: center - outerOffset, y: center + outerOffset * 0.5 },      // Left section
      8: { x: center - innerOffset, y: center + outerOffset * 0.4 },      // Bottom-left
      9: { x: center - innerOffset, y: center + innerOffset },            // Left-bottom
      10: { x: center, y: center + outerOffset * 0.6 },                   // Bottom section
      11: { x: center + innerOffset, y: center + innerOffset },           // Right-bottom
      12: { x: center + innerOffset, y: center + outerOffset * 0.4 }      // Bottom-right
    }
  };
}

/**
 * Draw square chart with simple diagonal divisions
 * @param {number} center - Center point
 * @param {number} halfSize - Half the square size
 * @returns {string} SVG elements for square and divisions
 */
function drawSquareChart(center, halfSize) {
  const top = center - halfSize;
  const bottom = center + halfSize;
  const left = center - halfSize;
  const right = center + halfSize;

  let svg = '';

  // Square outline
  svg += `<rect x="${left}" y="${top}" width="${halfSize * 2}" height="${halfSize * 2}"
    fill="white" stroke="black" stroke-width="2.5"/>`;

  // Main diagonals (corner to corner)
  svg += `<line x1="${left}" y1="${top}" x2="${right}" y2="${bottom}"
    stroke="black" stroke-width="2"/>`;
  svg += `<line x1="${right}" y1="${top}" x2="${left}" y2="${bottom}"
    stroke="black" stroke-width="2"/>`;

  // Vertical center line
  svg += `<line x1="${center}" y1="${top}" x2="${center}" y2="${bottom}"
    stroke="black" stroke-width="2"/>`;

  // Horizontal center line
  svg += `<line x1="${left}" y1="${center}" x2="${right}" y2="${center}"
    stroke="black" stroke-width="2"/>`;

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
    fill="#666">${houseNum}</text>`;
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
    font-size="24"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    font-weight="bold"
    fill="#000">${planetText}</text>`;
}

module.exports = {
  generateNorthIndianChartSVG
};
