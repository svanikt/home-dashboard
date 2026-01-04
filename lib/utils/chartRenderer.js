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
  // Based on North Indian chart convention and reference image
  const cornerPlanetOffset = halfSize * 0.55;  // For large corner triangles
  const sidePlanetOffset = halfSize * 0.65;    // For side sections
  const nearCenterOffset = halfSize * 0.25;    // For sections near center

  return {
    // House numbers positioned near center intersections (matching reference)
    houseNumbers: {
      1: { x: center + nearCenterOffset + 15, y: center + 5 },                  // Right of center
      2: { x: center, y: center - nearCenterOffset - 5 },                       // Above center
      3: { x: center - nearCenterOffset - 25, y: center - nearCenterOffset },   // Upper left
      4: { x: center - nearCenterOffset - 20, y: center + 5 },                  // Left of center
      5: { x: center - nearCenterOffset - 10, y: center + nearCenterOffset + 5 }, // Lower left diagonal
      6: { x: center - nearCenterOffset, y: center + nearCenterOffset + 15 },   // Further lower left
      7: { x: center - 10, y: center + nearCenterOffset + 25 },                 // Bottom left
      8: { x: center + 5, y: center + nearCenterOffset + 15 },                  // Below center
      9: { x: center + nearCenterOffset + 5, y: center + nearCenterOffset },    // Lower right diagonal
      10: { x: center + nearCenterOffset + 20, y: center + 5 },                 // Right of center
      11: { x: center - 5, y: center - nearCenterOffset + 5 },                  // Just below house 2
      12: { x: center + nearCenterOffset, y: center - nearCenterOffset }        // Upper right
    },

    // Planet positions in open areas (matching reference layout)
    planets: {
      // Large corner triangles (4 main sections)
      3: { x: center - cornerPlanetOffset, y: center - cornerPlanetOffset },    // Top-left corner (Ke in ref)
      6: { x: center - cornerPlanetOffset, y: center + cornerPlanetOffset },    // Bottom-left corner (Mo Sa in ref)
      9: { x: center + cornerPlanetOffset, y: center + cornerPlanetOffset },    // Bottom-right corner
      12: { x: center + cornerPlanetOffset, y: center - cornerPlanetOffset },   // Top-right corner

      // Side sections
      1: { x: center + sidePlanetOffset, y: center - 10 },                      // Right side (As in ref)
      4: { x: center, y: center - sidePlanetOffset + 20 },                      // Top section
      7: { x: center - sidePlanetOffset + 30, y: center + 20 },                 // Left side (Ra in ref)
      10: { x: center, y: center + sidePlanetOffset - 20 },                     // Bottom section (Ma Ju Ve in ref)

      // Smaller sections near center
      2: { x: center + nearCenterOffset + 20, y: center - nearCenterOffset - 20 },  // Upper right area
      5: { x: center - nearCenterOffset - 20, y: center - nearCenterOffset + 20 },  // Upper left area
      8: { x: center - nearCenterOffset, y: center + nearCenterOffset + 30 },       // Lower left area
      11: { x: center + nearCenterOffset + 20, y: center + nearCenterOffset }       // Lower right area (Su Me in ref)
    }
  };
}

/**
 * Draw square chart with center cross, rotated cross, and inner diamond
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

  // Outer square
  svg += `<rect x="${left}" y="${top}" width="${halfSize * 2}" height="${halfSize * 2}"
    fill="white" stroke="black" stroke-width="2.5"/>`;

  // Vertical center line (full height)
  svg += `<line x1="${center}" y1="${top}" x2="${center}" y2="${bottom}"
    stroke="black" stroke-width="2"/>`;

  // Horizontal center line (full width)
  svg += `<line x1="${left}" y1="${center}" x2="${right}" y2="${center}"
    stroke="black" stroke-width="2"/>`;

  // Diagonal lines from corners to center (the "rotated cross")
  // Top-left corner to center
  svg += `<line x1="${left}" y1="${top}" x2="${center}" y2="${center}"
    stroke="black" stroke-width="2"/>`;
  // Top-right corner to center
  svg += `<line x1="${right}" y1="${top}" x2="${center}" y2="${center}"
    stroke="black" stroke-width="2"/>`;
  // Bottom-left corner to center
  svg += `<line x1="${left}" y1="${bottom}" x2="${center}" y2="${center}"
    stroke="black" stroke-width="2"/>`;
  // Bottom-right corner to center
  svg += `<line x1="${right}" y1="${bottom}" x2="${center}" y2="${center}"
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
    font-size="14"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    fill="#999">${houseNum}</text>`;
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
    font-size="28"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    font-weight="bold"
    fill="#000">${planetText}</text>`;
}

module.exports = {
  generateNorthIndianChartSVG
};
