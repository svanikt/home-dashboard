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
    // House numbers - positioned exactly as in reference
    houseNumbers: {
      // Top area cluster (in upper diamond section) - NOTE: 11 appears here in some chart styles
      2: { x: center - 20, y: center - halfSize * 0.45 },      // Upper left of top cluster
      12: { x: center + 20, y: center - halfSize * 0.45 },     // Upper right of top cluster
      4: { x: center, y: center - halfSize * 0.25 },           // Bottom of top cluster

      // Left diagonal area
      3: { x: center - halfSize * 0.45, y: center - halfSize * 0.45 }, // Upper left diagonal
      5: { x: center - halfSize * 0.35, y: center - halfSize * 0.15 }, // Left diagonal middle-upper

      // Center horizontal line
      7: { x: center - halfSize * 0.15, y: center + 5 },       // Left of center
      1: { x: center + halfSize * 0.15, y: center + 5 },       // Right of center

      // Lower left diagonal area
      6: { x: center - halfSize * 0.35, y: center + halfSize * 0.25 }, // Lower left diagonal upper
      8: { x: center - halfSize * 0.25, y: center + halfSize * 0.35 }, // Lower left diagonal lower

      // Bottom center
      10: { x: center, y: center + halfSize * 0.35 },          // Bottom center

      // Lower right area
      11: { x: center + halfSize * 0.25, y: center + halfSize * 0.35 }, // Lower right
      9: { x: center + halfSize * 0.35, y: center + halfSize * 0.45 }   // Lower right far
    },

    // Planet positions - in open spaces exactly per reference
    planets: {
      // Four corner triangles
      3: { x: center - halfSize * 0.65, y: center - halfSize * 0.65 },  // Upper left corner
      12: { x: center + halfSize * 0.65, y: center - halfSize * 0.35 }, // Upper right corner (Ke)
      6: { x: center - halfSize * 0.65, y: center + halfSize * 0.65 },  // Lower left corner
      9: { x: center + halfSize * 0.65, y: center + halfSize * 0.65 },  // Lower right corner

      // Four diamond side sections
      1: { x: center + halfSize * 0.65, y: center + halfSize * 0.05 },  // Right side (As)
      4: { x: center, y: center - halfSize * 0.65 },                    // Top side
      7: { x: center - halfSize * 0.65, y: center + halfSize * 0.05 },  // Left side (Mo Sa)
      10: { x: center, y: center + halfSize * 0.65 },                   // Bottom side (Ma Ju Ve)

      // Four smaller triangular sections
      2: { x: center + halfSize * 0.3, y: center - halfSize * 0.55 },   // Upper right
      5: { x: center - halfSize * 0.3, y: center - halfSize * 0.55 },   // Upper left
      8: { x: center - halfSize * 0.3, y: center + halfSize * 0.55 },   // Lower left (Ra)
      11: { x: center + halfSize * 0.3, y: center + halfSize * 0.55 }   // Lower right (Su Me)
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
