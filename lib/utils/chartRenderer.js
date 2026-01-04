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
  const center = width / 2;
  const diamondSize = Math.min(width, height) * 0.7; // 70% of container
  const halfDiamond = diamondSize / 2;

  // Define house positions in North Indian diamond layout
  // House 1 is at the top, arranged counter-clockwise
  const housePositions = getHousePositions(center, halfDiamond);

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;

  // White background
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;

  // Draw diamond outline
  svg += drawDiamond(center, halfDiamond);

  // Draw house divisions
  svg += drawHouseDivisions(center, halfDiamond);

  // Add content for each house
  for (let house = 1; house <= 12; house++) {
    const pos = housePositions[house];
    const sign = chartData.houseToSign[house];

    // Get planets in this house (based on sign)
    const planets = chartData.planetsByHouse[sign] || [];

    svg += drawHouseContent(house, pos, sign, planets);
  }

  svg += '</svg>';

  return svg;
}

/**
 * Calculate house positions for North Indian chart
 * @param {number} center - Center point of SVG
 * @param {number} halfDiamond - Half the diamond size
 * @returns {Object} House positions with x, y coordinates
 */
function getHousePositions(center, halfDiamond) {
  // North Indian chart layout (diamond shape)
  // Positions are calculated for a fixed diamond orientation
  const offset = halfDiamond * 0.25; // Offset for inner positions

  return {
    1: { x: center, y: center - halfDiamond + 20 },           // Top (Ascendant)
    2: { x: center - offset, y: center - halfDiamond + 40 },  // Top-left
    3: { x: center - halfDiamond + 40, y: center - offset },  // Left-top
    4: { x: center - halfDiamond + 20, y: center },           // Left
    5: { x: center - halfDiamond + 40, y: center + offset },  // Left-bottom
    6: { x: center - offset, y: center + halfDiamond - 40 },  // Bottom-left
    7: { x: center, y: center + halfDiamond - 20 },           // Bottom
    8: { x: center + offset, y: center + halfDiamond - 40 },  // Bottom-right
    9: { x: center + halfDiamond - 40, y: center + offset },  // Right-bottom
    10: { x: center + halfDiamond - 20, y: center },          // Right
    11: { x: center + halfDiamond - 40, y: center - offset }, // Right-top
    12: { x: center + offset, y: center - halfDiamond + 40 }  // Top-right
  };
}

/**
 * Draw the diamond outline
 * @param {number} center - Center point
 * @param {number} halfDiamond - Half diamond size
 * @returns {string} SVG path element
 */
function drawDiamond(center, halfDiamond) {
  const top = center - halfDiamond;
  const bottom = center + halfDiamond;
  const left = center - halfDiamond;
  const right = center + halfDiamond;

  return `<path d="M${center},${top} L${right},${center} L${center},${bottom} L${left},${center} Z"
    fill="white" stroke="black" stroke-width="2"/>`;
}

/**
 * Draw house division lines
 * @param {number} center - Center point
 * @param {number} halfDiamond - Half diamond size
 * @returns {string} SVG line elements
 */
function drawHouseDivisions(center, halfDiamond) {
  const top = center - halfDiamond;
  const bottom = center + halfDiamond;
  const left = center - halfDiamond;
  const right = center + halfDiamond;

  let lines = '';

  // Vertical center line
  lines += `<line x1="${center}" y1="${top}" x2="${center}" y2="${bottom}"
    stroke="black" stroke-width="1.5"/>`;

  // Horizontal center line
  lines += `<line x1="${left}" y1="${center}" x2="${right}" y2="${center}"
    stroke="black" stroke-width="1.5"/>`;

  // Diagonal lines (creating the 12 houses)
  const offset = halfDiamond * 0.5;

  // Top-left to bottom-right diagonal divisions
  lines += `<line x1="${center - offset}" y1="${top}" x2="${left}" y2="${center - offset}"
    stroke="black" stroke-width="1"/>`;
  lines += `<line x1="${left}" y1="${center + offset}" x2="${center - offset}" y2="${bottom}"
    stroke="black" stroke-width="1"/>`;
  lines += `<line x1="${center + offset}" y1="${bottom}" x2="${right}" y2="${center + offset}"
    stroke="black" stroke-width="1"/>`;
  lines += `<line x1="${right}" y1="${center - offset}" x2="${center + offset}" y2="${top}"
    stroke="black" stroke-width="1"/>`;

  // Top-right to bottom-left diagonal divisions
  lines += `<line x1="${center + offset}" y1="${top}" x2="${right}" y2="${center - offset}"
    stroke="black" stroke-width="1"/>`;
  lines += `<line x1="${right}" y1="${center + offset}" x2="${center + offset}" y2="${bottom}"
    stroke="black" stroke-width="1"/>`;
  lines += `<line x1="${center - offset}" y1="${bottom}" x2="${left}" y2="${center + offset}"
    stroke="black" stroke-width="1"/>`;
  lines += `<line x1="${left}" y1="${center - offset}" x2="${center - offset}" y2="${top}"
    stroke="black" stroke-width="1"/>`;

  return lines;
}

/**
 * Draw content for a single house
 * @param {number} houseNum - House number (1-12)
 * @param {Object} position - Position {x, y}
 * @param {number} signNum - Sign number (1-12)
 * @param {Array} planets - Array of planet abbreviations in this house
 * @returns {string} SVG text elements
 */
function drawHouseContent(houseNum, position, signNum, planets) {
  const { x, y } = position;
  let content = '';

  // House number (small, subtle) - scaled for 1200px chart
  content += `<text x="${x}" y="${y - 50}"
    font-size="28"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    fill="#666">${houseNum}</text>`;

  // Sign abbreviation - scaled for 1200px chart
  const signAbbr = getSignAbbr(signNum);
  content += `<text x="${x}" y="${y}"
    font-size="36"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    font-weight="600"
    fill="#000">${signAbbr}</text>`;

  // Planets (if any) - scaled for 1200px chart
  if (planets && planets.length > 0) {
    const planetText = planets.join(' ');
    content += `<text x="${x}" y="${y + 48}"
      font-size="40"
      font-family="Arial, sans-serif"
      text-anchor="middle"
      font-weight="bold"
      fill="#c00">${planetText}</text>`;
  }

  return content;
}

module.exports = {
  generateNorthIndianChartSVG
};
