'use strict';

/**
 * Preview Generator Service
 *
 * Uses Puppeteer to render a mailing in the Mosaico editor
 * and extract the generated HTML via viewModel.exportHTML().
 *
 * This is necessary because Mosaico uses Knockout.js which requires
 * a browser DOM to render templates - there's no server-side rendering option.
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const config = require('../node.config.js');
const logger = require('../utils/logger.js');

// Build URL based on server config
const PROTOCOL = `http${config.forcessl ? 's' : ''}://`;
// Use the same approach as generate-preview.controller.js
const VERSION_PAGE = `${PROTOCOL}${config.host}/api/version`;
const getEditorUrl = (mailingId) =>
  `${PROTOCOL}${config.host}/editor/${mailingId}`;

// Timeout for waiting for Mosaico to load (30 seconds)
const MOSAICO_LOAD_TIMEOUT = 30000;

// Timeout for the entire operation (60 seconds)
const TOTAL_TIMEOUT = 60000;

/**
 * Get Puppeteer browser launch options
 * Uses the same approach as generate-preview.controller.js
 * but with explicit userDataDir to avoid TMPDIR issues
 */
function getBrowserLaunchOptions() {
  // Generate unique user data dir in /tmp to avoid conflicts
  const userDataDir = `/tmp/puppeteer_preview_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  return {
    userDataDir,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      '--single-process',
      // Suppress Chrome logging noise
      '--log-level=3',
      '--silent-debugger-extension-api',
    ],
  };
}

/**
 * Generate previewHtml for a mailing using Puppeteer
 *
 * @param {Object} params
 * @param {string} params.mailingId - The mailing ID to generate preview for
 * @param {Object} params.cookies - Request cookies for authentication
 * @returns {Promise<string>} The generated HTML
 */
async function generatePreviewHtml({ mailingId, cookies }) {
  const startTime = Date.now();

  // Ensure TMPDIR exists - Chrome uses it for shared memory even with userDataDir set
  // (index.js sets TMPDIR to ~/badsender-vips)
  const tmpDir = process.env.TMPDIR;
  if (tmpDir && !fs.existsSync(tmpDir)) {
    fs.mkdirpSync(tmpDir);
  }

  const launchOptions = getBrowserLaunchOptions();
  let browser;

  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (launchError) {
    logger.error(
      `[PreviewGenerator] Failed to launch browser: ${launchError.message}`
    );
    throw launchError;
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Log browser errors
    page.on('pageerror', (error) =>
      logger.error(`[PreviewGenerator] Browser error: ${error.message}`)
    );

    // Set cookies for authentication
    await page.goto(VERSION_PAGE, { timeout: TOTAL_TIMEOUT });

    if (cookies && Object.keys(cookies).length > 0) {
      // Extract domain from host (remove port if present)
      const domain = config.host.split(':')[0];
      const puppeteerCookies = Object.entries(cookies).map(([name, value]) => ({
        name,
        value,
        domain,
        path: '/',
      }));
      await page.setCookie(...puppeteerCookies);
    }

    // Navigate to the editor
    const editorUrl = getEditorUrl(mailingId);
    await page.goto(editorUrl, {
      waitUntil: 'networkidle0',
      timeout: TOTAL_TIMEOUT,
    });

    // Check if redirected to login (authentication failed)
    const pageUrl = page.url();
    if (pageUrl.includes('/account/login')) {
      logger.error('[PreviewGenerator] Redirected to login - authentication failed');
      throw new Error('Authentication failed - redirected to login page');
    }

    // Wait for Mosaico's viewModel to be ready
    await page.waitForFunction(
      () => {
        return (
          typeof window.viewModel !== 'undefined' &&
          typeof window.viewModel.exportHTML === 'function'
        );
      },
      { timeout: MOSAICO_LOAD_TIMEOUT }
    );

    // Execute exportHTML() to get the rendered HTML
    const previewHtml = await page.evaluate(() => {
      return window.viewModel.exportHTML();
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.log(
      `[PreviewGenerator] Generated preview in ${elapsed}s (${previewHtml.length} chars)`
    );

    return previewHtml;
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.error(
      `[PreviewGenerator] Failed after ${elapsed}s: ${error.message}`
    );
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generatePreviewHtml,
};
