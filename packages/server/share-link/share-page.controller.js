'use strict';

const asyncHandler = require('express-async-handler');

const { Mailings } = require('../common/models.common.js');
const previewSanitizer = require('../utils/preview-html-sanitizer.js');
const {
  createSanitizedPreviewCache,
} = require('../utils/sanitized-preview-cache.js');
const logger = require('../utils/logger.js');
const shareLinkService = require('./share-link.service.js');
const PAGES = require('./share-page.locales.js');
const { preheaderOf } = require('../../shared/quality/preheader.js');

/**
 * The public page a preview link opens (GET /share/:token), without an
 * account: the last saved version of the email, sanitized, in an iframe with
 * no permission (share-page.pug). Nothing on it runs a script, and every
 * failure is a page, never the API's JSON error.
 *
 * Two residual risks, accepted (docs/adr, quality control):
 * - The page publishes the name of the email (its title, so the reader's
 *   browser history, and the bar), and the subject and preheader when the
 *   company writes them in LePatron. Whoever holds the link reads them.
 * - The token travels in the URL. The request logs mask it (utils/logger.js),
 *   but the HTTP to HTTPS redirect (index.js) sends it back in `Location`,
 *   and the reverse proxy logs the full URL, upstream of this code.
 */

// The page never runs a script and loads nothing but what the email itself
// shows. Inherited by the email's iframe (srcdoc), which is sandboxed too.
const SHARE_PAGE_CSP = [
  "default-src 'none'",
  'img-src https: http: data:',
  "style-src 'unsafe-inline' https: http:",
  'font-src https: http: data:',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function setShareHeaders(res) {
  res.set({
    'Content-Security-Policy': SHARE_PAGE_CSP,
    // The token is in the URL: no image host of the email may read it.
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
}

// Views per link and per reader (req.ip), per window: a shared link must not
// be hammered, and one reader must not lock the link for the others. The
// counters are per worker. Made-up tokens are not counted: their shape is
// checked before any lookup (resolveToken), and 256 bits make enumeration
// hopeless, so each costs one indexed lookup and a page that costs nothing
// to render. A process-wide counter of them let a flood of made-up tokens
// answer 429 to every reader holding a wrong or revoked link.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_VIEWS_PER_WINDOW = 300;
const MAX_TRACKED_VIEWERS = 10000;
const views = new Map();

/** @returns {number} seconds before the next view is allowed, 0 to go ahead */
function viewBlockedFor(key, now = Date.now()) {
  const entry = views.get(key);
  if (!entry || entry.since < now - WINDOW_MS) {
    if (views.size > MAX_TRACKED_VIEWERS) views.clear();
    views.set(key, { since: now, count: 1 });
    return 0;
  }
  entry.count += 1;
  if (entry.count <= MAX_VIEWS_PER_WINDOW) return 0;
  return Math.ceil((entry.since + WINDOW_MS - now) / 1000);
}

// The sanitized email of each shared version (utils/sanitized-preview-cache.js):
// a public page can be hammered with views, and each must cost neither a
// sanitization nor the transfer of previewHtml (up to PREVIEW_HTML_MAX_LENGTH)
// from the database. previewHtml is read only when the version is not held.
// Every web link of the email opens in a new tab, without an opener: inside
// the frame a page could not load (the CSP allows no frame), and a reader
// wants to try the links. The sanitizer sets it (sanitizeSharedPreviewHtml);
// the new tab gets no referrer, the policy of the page being inherited.
const PAGE_CACHE_BUDGET = 16 * 1024 * 1024; // characters
const pageCache = createSanitizedPreviewCache({
  sanitize: previewSanitizer.sanitizeSharedPreviewHtml,
  budget: PAGE_CACHE_BUDGET,
  // A single very large page must not push every other one out.
  maxEntry: PAGE_CACHE_BUDGET / 4,
});

/** @returns {Promise<string>} empty when the email was never saved */
async function sanitizedPage(mailing) {
  const held = pageCache.peek(mailing);
  if (held !== undefined) return held;
  const saved = await Mailings.findById(mailing._id, { previewHtml: 1 }).lean();
  if (!saved || !saved.previewHtml) return '';
  return pageCache.sanitizeCached({
    ...mailing,
    previewHtml: saved.previewHtml,
  });
}

// The subject and preheader lines of the bar, when the company writes them in
// LePatron and they are filled in. Read as plain text, Pug escapes them.
function copyLines(mailing, lang, metadata) {
  if (!metadata) return [];
  const page = PAGES[lang];
  const subject =
    typeof mailing.subject === 'string' ? mailing.subject.trim() : '';
  const preheader = preheaderOf(mailing.data);
  return [
    subject && { label: page.subject, value: subject },
    preheader && { label: page.preheader, value: preheader },
  ].filter(Boolean);
}

// An unknown link has no language of its own: the reader's, English or French.
function pickLang(req) {
  return /^en\b/i.test(req.get('accept-language') || '') ? 'en' : 'fr';
}

function renderNotice(res, status, lang, kind) {
  const page = PAGES[lang][kind];
  res.status(status).render('share-page', {
    lang,
    title: page.title,
    message: page.message,
  });
}

// When the link ends, to the minute, as the editor shows it (share-link-panel.js
// formatDate): a day alone read differently on each side of midnight. The
// editor shows the author's own clock; the reader may be anywhere, so the page
// names the zone, the platform's (its clients are in France).
function formatDate(date, lang) {
  return new Date(date).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
    timeZoneName: 'short',
  });
}

async function showShare(req, res) {
  const { state, link } = await shareLinkService.resolveToken(req.params.token);
  if (state === 'unknown') {
    return renderNotice(res, 404, pickLang(req), 'unknown');
  }
  // A known link speaks its creator's language.
  const lang = link.lang === 'en' ? 'en' : 'fr';
  // 410 rather than 404 tells that the link existed, and the page speaks its
  // creator's language: a choice, for the reader who kept an old link and
  // would otherwise wonder whether it was ever right.
  if (state === 'expired') return renderNotice(res, 410, lang, 'expired');
  const retryAfter = viewBlockedFor(`${link._id}|${req.ip}`);
  if (retryAfter > 0) {
    res.set('Retry-After', String(retryAfter));
    return renderNotice(res, 429, lang, 'busy');
  }

  // Never previewHtml here: sanitizedPage reads it when it needs it.
  const mailing = await Mailings.findById(link._mailing, {
    updatedAt: 1,
    name: 1,
    _company: 1,
    subject: 1,
    // Only the preheader of the content model, never the whole of it.
    'data.preheaderText': 1,
    'data.preheaderBlock.preheaderText': 1,
    'data.preheaderVisible': 1,
  }).lean();
  if (!mailing) return renderNotice(res, 404, lang, 'unknown');
  // The company the email belongs to now, not the one of the link: a transfer
  // moves an email, and the link follows the email.
  const sharing = await shareLinkService.companySharing(mailing._company);
  if (!sharing.allowed) return renderNotice(res, 404, lang, 'unknown');
  const html = await sanitizedPage(mailing);
  if (!html) return renderNotice(res, 404, lang, 'empty');

  return res.render('share-page', {
    lang,
    title: mailing.name,
    name: mailing.name,
    meta: PAGES[lang].meta(formatDate(link.expiresAt, lang)),
    copy: copyLines(mailing, lang, sharing.metadata),
    html,
  });
}

/**
 * @api {get} /share/:token public preview of an email
 * @apiPermission public
 * @apiName ShareMailingPreview
 * @apiGroup Mailings
 * @apiDescription The last saved version, sanitized, in a sandboxed iframe.
 *   404 for an unknown or revoked link, or one of an email whose company is
 *   inactive, lost the email builder or turned the preview links off; 410 for
 *   an expired one.
 */
async function renderShare(req, res) {
  try {
    setShareHeaders(res);
    await showShare(req, res);
  } catch (error) {
    // Whatever failed stays in the logs: the reader gets a page. Should that
    // page fail too, asyncHandler hands the error to Express: never a crash.
    logger.error('[SHARE] preview page failed', error);
    renderNotice(res, 500, pickLang(req), 'error');
  }
}

module.exports = { renderShare: asyncHandler(renderShare) };
