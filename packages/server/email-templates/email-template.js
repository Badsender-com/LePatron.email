'use strict';

const fs = require('fs');
const path = require('path');
const tmpl = require('blueimp-tmpl');

const config = require('../node.config.js');
const logger = require('../utils/logger.js');
const {
  COMMON_TEXTS,
  PASSWORD_TEXTS,
  passwordTextsFor,
} = require('./email-texts.js');
const { ICONS } = require('./email-icons.js');

// The emails the application sends about an account (password, two-factor
// authentication): one HTML template, filled with the texts of each email in
// the account's language. The decisions behind it, and the grid it answers,
// are in docs/emails/.

tmpl.load = function (id) {
  const filename = path.join(__dirname, `${id}.html`);
  return fs.readFileSync(filename, 'utf8');
};

// put in cache
const accountTemplate = tmpl('account-email');

// The languages of the application: the emails speak those, no other.
const LANGUAGES = ['fr', 'en'];
const FALLBACK_LANGUAGE = 'en';

// The images of the emails, built by scripts/build-email-images.js from the
// logo and the icons of the application. The application serves them from its
// public folder (public/media/email): an email links them by an absolute
// address, with the scheme and the host of the site, as for its other links.
const ASSETS_PATH = '/media/email';
const DEFAULT_ICON = 'lock';

const PRIVACY_URL = 'https://www.badsender.com/vie-privee/';
const DPO_EMAIL = 'dpo@badsender.com';

// The links in the emails use the scheme the site is served with: https
// everywhere but in development, as the FORCE HTTPS middleware of index.js
// decides (`forcessl` arrives as a string from the environment, "false"
// included, so it cannot tell).
function siteOrigin() {
  return `http${config.isDev ? '' : 's'}://${config.host}`;
}

/**
 * The language an email is written in: the account's when the application
 * translates it, English otherwise. An untranslated language is logged, so
 * it is not mistaken for a choice.
 *
 * @param {string} [lang]
 * @returns {'fr'|'en'}
 */
function resolveLanguage(lang) {
  // `fr-FR` and `FR` are French. The value is a free string of the account:
  // it is logged quoted and cut, never raw.
  const base =
    typeof lang === 'string' ? lang.trim().toLowerCase().split(/[-_]/)[0] : '';
  if (LANGUAGES.includes(base)) return base;
  if (lang) {
    logger.warn(
      `[email] ${JSON.stringify(
        String(lang).slice(0, 20)
      )} is not a translated language: the email is in ${FALLBACK_LANGUAGE}`
    );
  }
  return FALLBACK_LANGUAGE;
}

/**
 * Everything `mail.send` needs of an email but the recipient.
 *
 * @param {Object} texts the email's texts by language: `{ fr, en }`, each with
 *   `subject`, `title`, `preheader`, `desc` and, with a `url`, `button`
 * @param {string} [lang] the account's
 * @param {Object} [data] `url`: where the button leads (none, no button);
 *   `icon`: the one of the card, one of ICONS (a lock when none); `code`: a
 *   one-time code, shown apart under the title
 * @returns {{subject: string, text: string, html: string}}
 */
function composeEmail(texts, lang, { url, icon = DEFAULT_ICON, code } = {}) {
  const language = resolveLanguage(lang);
  const t = texts[language];
  const c = COMMON_TEXTS[language];
  const iconName = ICONS.includes(icon) ? icon : DEFAULT_ICON;
  // The images are hosted by the application: absolute addresses.
  const assets = `${siteOrigin()}${ASSETS_PATH}`;
  const benefits = t.benefits && {
    title: t.benefits.title,
    items: t.benefits.items.map((item) => ({
      ...item,
      src: `${assets}/icon-${
        ICONS.includes(item.icon) ? item.icon : DEFAULT_ICON
      }.png`,
    })),
  };
  const html = accountTemplate({
    lang: language,
    t,
    c,
    url,
    code,
    benefits,
    logoSrc: `${assets}/logo.png`,
    iconSrc: `${assets}/icon-${iconName}.png`,
    privacyUrl: PRIVACY_URL,
    dpo: DPO_EMAIL,
  });
  const text = [
    code ? `${t.title}${c.colon}${code}` : t.title,
    t.desc,
    url ? `${t.button}${c.colon}${url}` : '',
    c.sent,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    subject: `${config.emailOptions.passwordSubjectPrefix} – ${t.subject}`,
    text,
    html,
  };
}

module.exports = {
  composeEmail,
  siteOrigin,
  resolveLanguage,
  PASSWORD_TEXTS,
  passwordTextsFor,
  ICONS,
};
