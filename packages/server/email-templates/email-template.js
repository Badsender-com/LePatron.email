'use strict';

const fs = require('fs');
const path = require('path');
const tmpl = require('blueimp-tmpl');

const config = require('../node.config.js');

// The emails the application sends about an account (password, two-factor
// authentication): one HTML template, filled with the texts of each email in
// the account's language.

tmpl.load = function (id) {
  const filename = path.join(__dirname, `${id}.html`);
  return fs.readFileSync(filename, 'utf8');
};

// put in cache
const accountTemplate = tmpl('reset-password');

const COMMON_TEXTS = {
  fr: {
    baseline: "L'EMAILING SUR MESURE",
    footerBaseline1: 'Pour des emails sur mesure',
    footerBaseline2: 'et modulables',
    rgpd1:
      'Conformément au règlement européen pour la protection des données personnelles (RGPD) et, en France, à la loi "informatique et libertés", vous bénéficiez notamment d\'un droit d\'accès, de rectification et de suppression des données personnelles vous concernant. Pour en savoir davantage sur tous vos droits et les conditions dans lesquelles Badsender traite vos données personnelles, nous vous invitons à prendre connaissance de',
    rgpd2:
      "Pour exercer vos droits ou pour toute question, nous vous remercions de nous contacter à l'adresse suivante&nbsp;:",
    rgpdUrl: 'notre Politique de confidentialité',
    zeroCarbon:
      "N'oubliez pas de détruire ce message une fois que vous l'aurez consulté. Toutes nos bonnes pratiques pour un emailing + vert sont à disposition ",
    zeroCarbonLink: 'en suivant ce lien',
    legals: 'Badsender SASU - SIRET 81310812300015',
  },
  en: {
    baseline: 'TAILOR-MADE EMAILING',
    footerBaseline1: 'For tailor-made emails',
    footerBaseline2: 'and scalable',
    rgpd1:
      'In accordance with the European regulation for the protection of personal data (GDPR) and, in France, with the law "informatique et liberté", you have the right to access, rectify and delete your personal data. To learn more about all your rights and the conditions under which Badsender processes your personal data, we invite you to read',
    rgpd2:
      'To exercise your rights or if you have any questions, please contact us at the following address:',
    rgpdUrl: 'our Privacy Policy',
    zeroCarbon:
      "Don't forget to delete this message once you've viewed it. All our best practices for a green emailing are available ",
    zeroCarbonLink: 'by following this link',
    legals: 'Badsender SASU - SIRET 81310812300015',
  },
};

const PASSWORD_TEXTS = {
  'reset-password': {
    fr: {
      title: "Bienvenue sur l'email builder de Badsender",
      desc:
        "Cliquez sur le bouton ci-dessous pour initialiser votre mot de passe, ou copiez l'url suivante dans votre navigateur:",
      reset: 'INITIALISER MON MOT DE PASSE',
    },
    en: {
      title: "Welcome to the Badsender's email builder",
      desc:
        'Click the button below to reset your password, or copy the following URL into your browser:',
      reset: 'RESET MY PASSWORD',
    },
  },
  'reset-success': {
    fr: {
      title: 'Votre mot de passe a bien été réinitialisé',
      desc:
        "Cliquez sur le bouton ci-dessous pour vous connecter, ou copiez l'url suivante dans votre navigateur:",
      reset: 'SE CONNECTER',
    },
    en: {
      title: 'Your password has been successfully updated',
      desc:
        'Click the button below to login, or copy the following URL into your browser:',
      reset: 'LOGIN',
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
 * @param {Object} texts the email's texts by language: `{ fr, en }`, each
 *   with `title`, `desc` and `reset` (the button)
 * @param {string} [lang] the account's, English when unknown
 * @param {Object} data `url` (the button's link), `type` ('admin' shows the
 *   title)
 * @returns {string} the HTML of the email
 */
function renderEmail(texts, lang, data) {
  const language = texts[lang] ? lang : 'en';
  const t = { ...COMMON_TEXTS[language], ...texts[language] };
  return accountTemplate({ t, ...data });
}

module.exports = { renderEmail, siteOrigin, PASSWORD_TEXTS };
