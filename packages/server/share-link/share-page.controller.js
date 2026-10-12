'use strict';

const { Mailings } = require('../common/models.common.js');
const previewSanitizer = require('../utils/preview-html-sanitizer.js');
const {
  createSanitizedPreviewCache,
} = require('../utils/sanitized-preview-cache.js');
const logger = require('../utils/logger.js');
const shareLinkService = require('./share-link.service.js');

/**
 * The public page a preview link opens (GET /share/:token), without an
 * account: the last saved version of the email, sanitized, in an iframe with
 * no permission (share-page.pug). Nothing on it runs a script, and every
 * failure is a page, never the API's JSON error.
 */

const PAGES = {
  fr: {
    unknown: {
      title: 'Lien introuvable',
      message:
        "Ce lien d'aperçu n'existe pas ou a été désactivé. Demandez un nouveau lien à la personne qui vous l'a envoyé.",
    },
    expired: {
      title: 'Lien expiré',
      message:
        "Ce lien d'aperçu a expiré. Demandez un nouveau lien à la personne qui vous l'a envoyé.",
    },
    empty: {
      title: 'Aperçu indisponible',
      message:
        "Cet email n'a pas encore d'aperçu : il doit d'abord être enregistré dans l'éditeur.",
    },
    busy: {
      title: 'Trop de consultations',
      message: 'Ce lien a été ouvert trop souvent. Réessayez dans un moment.',
    },
    error: {
      title: 'Aperçu indisponible',
      message: "L'aperçu n'a pas pu être affiché. Réessayez dans un moment.",
    },
    meta: (date) =>
      `Aperçu de la dernière version enregistrée · lien valable jusqu'au ${date} · les liens de l'email s'ouvrent dans un nouvel onglet`,
    subject: 'Objet',
    preheader: 'Préheader',
  },
  en: {
    unknown: {
      title: 'Link not found',
      message:
        'This preview link does not exist or was turned off. Ask whoever sent it for a new one.',
    },
    expired: {
      title: 'Link expired',
      message:
        'This preview link has expired. Ask whoever sent it for a new one.',
    },
    empty: {
      title: 'Preview unavailable',
      message:
        'This email has no preview yet: it must first be saved in the editor.',
    },
    busy: {
      title: 'Too many views',
      message: 'This link was opened too often. Try again in a moment.',
    },
    error: {
      title: 'Preview unavailable',
      message: 'The preview could not be shown. Try again in a moment.',
    },
    meta: (date) =>
      `Preview of the last saved version · link valid until ${date} · links in the email open in a new tab`,
    subject: 'Subject',
    preheader: 'Preheader',
  },
};

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

// Views per link, and unknown tokens for the process, per window. Guessing a
// token is hopeless (256 bits); this keeps a shared link from being hammered,
// and answers a flood of made-up tokens with a page that costs nothing to
// render. Each made-up token still costs one indexed lookup; the counters are
// per worker.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_VIEWS_PER_LINK = 300;
const MAX_UNKNOWN_PER_WINDOW = 1000;
const views = new Map();
let unknown = { since: Date.now(), count: 0 };

function allowView(key, now = Date.now()) {
  const entry = views.get(key);
  if (!entry || entry.since < now - WINDOW_MS) {
    if (views.size > 10000) views.clear();
    views.set(key, { since: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_VIEWS_PER_LINK;
}

function allowUnknown(now = Date.now()) {
  if (unknown.since < now - WINDOW_MS) unknown = { since: now, count: 0 };
  unknown.count += 1;
  return unknown.count <= MAX_UNKNOWN_PER_WINDOW;
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

// Templates declare their preheader at the root or in a root-level
// `preheaderBlock`, and versafix-like ones can turn it off: read as the editor
// does (ext/quality/copy-fields.js), the first path that holds a string.
function preheaderOf(data) {
  if (!data || data.preheaderVisible === false) return '';
  const value = [data.preheaderText, data.preheaderBlock?.preheaderText].find(
    (candidate) => typeof candidate === 'string'
  );
  return value ? value.trim() : '';
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

// The platform's clients are in France: dates read in Paris time, where a
// one-day link created in the evening ends the next day.
function formatDate(date, lang) {
  return new Date(date).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
}

async function showShare(req, res) {
  const { state, link } = await shareLinkService.resolveToken(req.params.token);
  if (state === 'unknown') {
    const lang = pickLang(req);
    return allowUnknown()
      ? renderNotice(res, 404, lang, 'unknown')
      : renderNotice(res, 429, lang, 'busy');
  }
  // A known link speaks its creator's language.
  const lang = link.lang === 'en' ? 'en' : 'fr';
  if (state === 'expired') return renderNotice(res, 410, lang, 'expired');
  if (!allowView(String(link._id))) {
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
  setShareHeaders(res);
  try {
    await showShare(req, res);
  } catch (error) {
    // Whatever failed stays in the logs: the reader gets a page.
    logger.error('[SHARE] preview page failed', error);
    renderNotice(res, 500, pickLang(req), 'error');
  }
}

module.exports = { renderShare };
