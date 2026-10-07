'use strict';

const { Mailings, Groups } = require('../common/models.common.js');
const GROUP_STATUS = require('../group/status.js');
const previewSanitizer = require('../utils/preview-html-sanitizer.js');
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

// The sanitized email of each shared version, whatever its size: the
// sanitizer is synchronous (about a second per MB), and a large preview must
// not be sanitized again at every view of a public page.
const PAGE_CACHE_BUDGET = 16 * 1024 * 1024; // characters
const pages = new Map();
let pagesSize = 0;

// Every link of the email opens in a new tab, without an opener: inside the
// frame a page could not load (the CSP allows no frame), and a reader wants to
// try the links. The sanitizer sets it on each link (sanitizeSharedPreviewHtml).
// The new tab gets no referrer, the policy of the page being inherited.
function sanitizedPage(mailing) {
  const key = `${mailing._id}:${new Date(mailing.updatedAt || 0).getTime()}`;
  if (pages.has(key)) return pages.get(key);
  const html = previewSanitizer.sanitizeSharedPreviewHtml(mailing.previewHtml);
  pages.set(key, html);
  pagesSize += html.length;
  while (pagesSize > PAGE_CACHE_BUDGET && pages.size > 1) {
    const [oldestKey, oldest] = pages.entries().next().value;
    pages.delete(oldestKey);
    pagesSize -= oldest.length;
  }
  return html;
}

// A link lives no longer than the company's access to the email builder.
// Links made by the admin, who has no company, have no company to check.
// Also says whether the company writes the subject in LePatron (email
// metadata): the page then shows the subject and the preheader.
async function companySharing(link) {
  if (!link._company) return { allowed: true, metadata: false };
  const group = await Groups.findById(link._company, {
    status: 1,
    enableEmailBuilder: 1,
    emailMetadata: 1,
  }).lean();
  const allowed = Boolean(
    group &&
      group.status !== GROUP_STATUS.INACTIVE &&
      group.enableEmailBuilder !== false
  );
  // Off unless the company opted in, as GUARD_EMAIL_METADATA reads it.
  const metadata = Boolean(group && group.emailMetadata?.enabled === true);
  return { allowed, metadata };
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
  const sharing = await companySharing(link);
  if (!sharing.allowed) return renderNotice(res, 404, lang, 'unknown');

  const mailing = await Mailings.findById(link._mailing, {
    previewHtml: 1,
    updatedAt: 1,
    name: 1,
    subject: 1,
    // Only the preheader of the content model, never the whole of it.
    'data.preheaderText': 1,
    'data.preheaderBlock.preheaderText': 1,
    'data.preheaderVisible': 1,
  }).lean();
  if (!mailing) return renderNotice(res, 404, lang, 'unknown');
  if (!mailing.previewHtml) return renderNotice(res, 404, lang, 'empty');

  return res.render('share-page', {
    lang,
    title: mailing.name,
    name: mailing.name,
    meta: PAGES[lang].meta(formatDate(link.expiresAt, lang)),
    copy: copyLines(mailing, lang, sharing.metadata),
    html: sanitizedPage(mailing),
  });
}

/**
 * @api {get} /share/:token public preview of an email
 * @apiPermission public
 * @apiName ShareMailingPreview
 * @apiGroup Mailings
 * @apiDescription The last saved version, sanitized, in a sandboxed iframe.
 *   404 for an unknown or revoked link, or one whose company lost the email
 *   builder; 410 for an expired one.
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
