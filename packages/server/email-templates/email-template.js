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
const COMMON_TEXTS = {
  fr: {
    fallback:
      'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    sent:
      'Cet email a été envoyé automatiquement par LePatron, l’email builder de Badsender.',
    data: 'Vos données personnelles :',
    privacy: 'politique de confidentialité',
    colon: ' : ',
  },
  en: {
    fallback: 'If the button does not work, copy this link into your browser:',
    sent:
      'This email was sent automatically by LePatron, Badsender’s email builder.',
    data: 'Your personal data:',
    privacy: 'privacy policy',
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
        'Vous avez demandé un nouveau mot de passe. Choisissez-le avec le bouton ci-dessous. Ce lien est valable 7 jours. Si ce n’est pas vous, ignorez cet email : votre mot de passe actuel reste valable.',
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
  // The new password is set.
  confirmation: {
    fr: {
      subject: 'Mot de passe modifié',
      title: 'Votre mot de passe a changé',
      preheader: 'Vous pouvez vous connecter avec votre nouveau mot de passe.',
      desc:
        'Vous avez choisi un nouveau mot de passe. Si ce n’est pas vous, prévenez l’administrateur technique de votre société.',
      button: 'Ouvrir LePatron',
    },
    en: {
      subject: 'Password changed',
      title: 'Your password has changed',
      preheader: 'You can sign in with your new password.',
      desc:
        'You chose a new password. If this was not you, tell your company’s technical administrator.',
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
  if (LANGUAGES.includes(lang)) return lang;
  if (lang) {
    logger.warn(
      `[email] "${lang}" is not a translated language: the email is in ${FALLBACK_LANGUAGE}`
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
