'use strict';

const fs = require('fs');
const path = require('path');
const tmpl = require('blueimp-tmpl');

const config = require('../node.config.js');
const logger = require('../utils/logger.js');

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

const PRIVACY_URL = 'https://www.badsender.com/vie-privee/';
const DPO_EMAIL = 'dpo@badsender.com';

// What every email says around its own text.
// In French a colon takes a no-break space before it, so a line never starts
// with one: the character U+00A0, written with an escape below, which the
// escaping of the template leaves alone.
const COMMON_TEXTS = {
  fr: {
    fallback:
      'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur\u00a0:',
    sent:
      'LePatron, l’email builder de Badsender, vous envoie cet email automatiquement.',
    data: 'Pour vos données personnelles, consultez notre',
    privacy: 'politique de confidentialité',
    or: 'ou écrivez à',
    colon: '\u00a0: ',
  },
  en: {
    fallback: 'If the button does not work, copy this link into your browser:',
    sent:
      'LePatron, Badsender’s email builder, sends you this email automatically.',
    data: 'For your personal data, read our',
    privacy: 'privacy policy',
    or: 'or write to',
    colon: ': ',
  },
};

// A link in a password email lives a week (`resetPassword` of the user
// schema): the texts below say so.
const PASSWORD_TEXTS = {
  // The first password of an account an administrator created.
  welcome: {
    fr: {
      subject: 'Bienvenue sur LePatron',
      title: 'Bienvenue sur LePatron',
      preheader: 'Choisissez votre mot de passe pour activer votre compte.',
      desc:
        'Un administrateur a créé votre compte. Choisissez votre mot de passe pour vous connecter. Ce lien est valable 7 jours.',
      button: 'Choisir mon mot de passe',
    },
    en: {
      subject: 'Welcome to LePatron',
      title: 'Welcome to LePatron',
      preheader: 'Choose your password to activate your account.',
      desc:
        'An administrator created your account. Choose your password to sign in. This link is valid for 7 days.',
      button: 'Choose my password',
    },
  },
  // A new password, an administrator's doing.
  reset: {
    fr: {
      subject: 'Nouveau mot de passe',
      title: 'Choisissez un nouveau mot de passe',
      preheader: 'Ce lien est valable 7 jours.',
      desc:
        'Un administrateur a réinitialisé votre mot de passe. Choisissez-en un nouveau pour vous connecter. Ce lien est valable 7 jours.',
      button: 'Choisir un nouveau mot de passe',
    },
    en: {
      subject: 'New password',
      title: 'Choose a new password',
      preheader: 'This link is valid for 7 days.',
      desc:
        'An administrator reset your password. Choose a new one to sign in. This link is valid for 7 days.',
      button: 'Choose a new password',
    },
  },
  // A new password, asked for by the person.
  forgot: {
    fr: {
      subject: 'Nouveau mot de passe',
      title: 'Choisissez un nouveau mot de passe',
      preheader: 'Ce lien est valable 7 jours.',
      desc:
        'Vous avez demandé un nouveau mot de passe. Choisissez-le avec le bouton ci-dessous. Ce lien est valable 7 jours. Si ce n’est pas vous, ignorez cet email\u00a0: votre mot de passe actuel reste valable.',
      button: 'Choisir un nouveau mot de passe',
    },
    en: {
      subject: 'New password',
      title: 'Choose a new password',
      preheader: 'This link is valid for 7 days.',
      desc:
        'You asked for a new password. Choose it with the button below. This link is valid for 7 days. If this was not you, ignore this email: your current password still works.',
      button: 'Choose a new password',
    },
  },
  // The password is set: a first one, or a new one. The mail cannot tell which
  // (the link does not remember), so it says neither.
  confirmation: {
    fr: {
      subject: 'Mot de passe enregistré',
      title: 'Votre mot de passe est enregistré',
      preheader: 'Vous pouvez vous connecter avec votre mot de passe.',
      desc:
        'Vous avez choisi votre mot de passe. Si ce n’est pas vous, prévenez l’administrateur technique de votre société.',
      button: 'Ouvrir LePatron',
    },
    en: {
      subject: 'Password saved',
      title: 'Your password is saved',
      preheader: 'You can sign in with your password.',
      desc:
        'You chose your password. If this was not you, tell your company’s technical administrator.',
      button: 'Open LePatron',
    },
  },
};

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
 * @param {Object} [data] `url`: where the button leads (none, no button)
 * @returns {{subject: string, text: string, html: string}}
 */
function composeEmail(texts, lang, { url } = {}) {
  const language = resolveLanguage(lang);
  const t = texts[language];
  const c = COMMON_TEXTS[language];
  const html = accountTemplate({
    lang: language,
    t,
    c,
    url,
    logo: `${siteOrigin()}/media/logo_lepatron.png`,
    privacyUrl: PRIVACY_URL,
    dpo: DPO_EMAIL,
  });
  const text = [
    t.title,
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

module.exports = { composeEmail, siteOrigin, resolveLanguage, PASSWORD_TEXTS };
