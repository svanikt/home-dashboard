const express = require('express');
const path = require('path');
const fs = require('fs');
const { buildDashboardData } = require('../lib/dataBuilders');
const { getDashboard, dashboardExists } = require('../config/dashboards');
const { getBaseUrl } = require('../lib/utils');
const { setStateKey } = require('../lib/state');

const router = express.Router();

/**
 * Middleware to validate dashboard ID
 */
function validateDashboard(req, res, next) {
  const dashboardId = req.params.dashboardId;

  if (!dashboardExists(dashboardId)) {
    return res.status(404).json({
      error: 'Dashboard not found',
      details: `Dashboard '${dashboardId}' does not exist`
    });
  }

  req.dashboardConfig = getDashboard(dashboardId);
  next();
}

/**
 * GET /api/dashboard/:dashboardId - Dashboard data API
 */
router.get('/api/dashboard/:dashboardId', validateDashboard, async (req, res) => {
  try {
    const data = await buildDashboardData(req.params.dashboardId, req, console);
    // Remove internal service statuses from public API response
    const { _serviceStatuses, ...publicData } = data;
    res.type('application/json').status(200).json(publicData);
  } catch (error) {
    console.error('Error generating dashboard data:', error);
    res.status(500).json({
      error: 'Failed to generate dashboard data',
      details: error.message
    });
  }
});

/**
 * GET /dashboard/:dashboardId - Server-side rendered dashboard view
 */
router.get('/dashboard/:dashboardId', validateDashboard, async (req, res) => {
  try {
    const dashboardConfig = req.dashboardConfig;
    const data = await buildDashboardData(req.params.dashboardId, req, console);
    data.isDevelopment = true;

    // Parse battery level from query param (0-100) if provided
    const batteryParam = req.query.battery;
    data.battery_level = batteryParam !== undefined ? parseInt(batteryParam, 10) : null;

    // (Optional) Check if custom fonts exist
    const customFontsPath = path.join(__dirname, '../views/styles/fonts/fonts.css');
    data.hasCustomFonts = fs.existsSync(customFontsPath);

    // Display dimensions from dashboard config
    data.display_width = dashboardConfig.display.width;
    data.display_height = dashboardConfig.display.height;

    // Render the appropriate template for this dashboard type
    res.render(dashboardConfig.template, data);
  } catch (error) {
    console.error('Error rendering dashboard display:', error);
    res.status(500).send('Failed to render dashboard display');
  }
});

/**
 * GET /dashboard/:dashboardId/image - Generate screenshot for e-paper display
 */
router.get('/dashboard/:dashboardId/image', validateDashboard, async (req, res) => {
  const startTime = Date.now();
  let browser;
  try {
    const puppeteer = require('puppeteer');
    const sharp = require('sharp');
    const baseUrl = getBaseUrl(req);
    const dashboardConfig = req.dashboardConfig;

    // Get display dimensions from dashboard config
    const displayWidth = dashboardConfig.display.width;
    const displayHeight = dashboardConfig.display.height;

    // Build display URL with battery param if provided
    const batteryParam = req.query.battery;
    const displayUrl = batteryParam !== undefined
      ? `${baseUrl}/dashboard/${req.params.dashboardId}?battery=${encodeURIComponent(batteryParam)}`
      : `${baseUrl}/dashboard/${req.params.dashboardId}`;

    // Check for system Chrome/Chromium on different platforms
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/usr/bin/chromium-browser', // Ubuntu/Debian
      '/usr/bin/chromium', // Some Linux distros
      '/usr/bin/google-chrome', // Google Chrome on Linux
    ];

    let executablePath;
    for (const path of chromePaths) {
      if (fs.existsSync(path)) {
        executablePath = path;
        break;
      }
    }

    browser = await puppeteer.launch({
      headless: true,
      timeout: 60000,
      executablePath: executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-features=VizDisplayCompositor',
        '--font-render-hinting=none',
        '--force-color-profile=srgb'
      ]
    });

    const page = await browser.newPage();

    // Log page errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.setViewport({
      width: displayWidth,
      height: displayHeight,
      deviceScaleFactor: 4
    });

    await page.goto(displayUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for fonts and icons to load
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 500));

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false
    });

    await browser.close();
    browser = null;

    // Convert to 1-bit black and white PNG for e-paper
    const processedImage = await sharp(screenshot)
      .greyscale()
      .resize(displayWidth, displayHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
        kernel: sharp.kernel.lanczos3
      })
      .normalise()
      .linear(1.2, -(128 * 0.2))
      .threshold(190)
      .png({
        palette: true,
        colors: 2,
        compressionLevel: 9
      })
      .toBuffer();

    // Log image info
    const meta = await sharp(processedImage).metadata();
    const latency = Date.now() - startTime;
    console.log(`[${req.params.dashboardId}] Processed image: ${processedImage.length} bytes, ${meta.width}x${meta.height}, ${meta.channels} channels, ${latency}ms`);

    // Track successful sync
    setStateKey(`last_display_sync_${req.params.dashboardId}`, {
      timestamp: Date.now(),
      status: 'success',
      imageSize: processedImage.length,
      latency: latency,
      error: null
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.dashboardId}-dashboard.png"`);
    res.send(processedImage);
  } catch (error) {
    console.error(`[${req.params.dashboardId}] Error generating display screenshot:`, error);

    const latency = Date.now() - startTime;

    // Track failed sync
    setStateKey(`last_display_sync_${req.params.dashboardId}`, {
      timestamp: Date.now(),
      status: 'failed',
      imageSize: null,
      latency: latency,
      error: error.message
    });

    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
    res.status(500).json({
      error: 'Failed to generate screenshot',
      details: error.message
    });
  }
});

// ===== LEGACY ROUTES (Backward Compatibility) =====
// These maintain compatibility with existing ESP32 code

/**
 * GET /api/dashboard - Legacy route (defaults to chripro)
 */
router.get('/api/dashboard', async (req, res) => {
  req.params.dashboardId = 'chripro';
  return router.handle(req, res);
});

/**
 * GET /dashboard - Legacy route (defaults to chripro)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const data = await buildDashboardData('chripro', req, console);
    data.isDevelopment = true;

    const batteryParam = req.query.battery;
    data.battery_level = batteryParam !== undefined ? parseInt(batteryParam, 10) : null;

    const customFontsPath = path.join(__dirname, '../views/styles/fonts/fonts.css');
    data.hasCustomFonts = fs.existsSync(customFontsPath);

    const dashboardConfig = getDashboard('chripro');
    data.display_width = dashboardConfig.display.width;
    data.display_height = dashboardConfig.display.height;

    res.render(dashboardConfig.template, data);
  } catch (error) {
    console.error('Error rendering dashboard display:', error);
    res.status(500).send('Failed to render dashboard display');
  }
});

/**
 * GET /dashboard/image - Legacy route (defaults to chripro)
 */
router.get('/dashboard/image', async (req, res, next) => {
  req.params.dashboardId = 'chripro';
  req.dashboardConfig = getDashboard('chripro');
  next();
}, router.get.bind(router, '/dashboard/:dashboardId/image'));

module.exports = router;
