'use strict';

const config = require('../node.config.js');
const logger = require('../utils/logger.js');
const mail = require('../mailing/mail.service.js');
const {
  renderEmail,
  siteOrigin,
} = require('../email-templates/email-template.js');

// The emails that tell a member about their two-factor authentication
// (ADR 0008). None names who acted: the security event keeps that.

const SUBJECTS = {
  fr: 'Double authentification',
  en: 'Two-factor authentication',
};

const SIGN_IN = { fr: 'SE CONNECTER', en: 'SIGN IN' };

const TEXTS = {
  reset: {
    fr: {
      title: 'Votre double authentification a été réinitialisée',
      desc:
        'Vous la configurerez de nouveau à votre prochaine connexion. Si vous n’attendiez pas ce changement, prévenez l’administrateur de votre groupe.',
      reset: SIGN_IN.fr,
    },
    en: {
      title: 'Your two-factor authentication was reset',
      desc:
        'You will set it up again at your next sign-in. If you did not expect this change, tell the administrator of your group.',
      reset: SIGN_IN.en,
    },
  },
  recoveryCodeUsed: {
    fr: {
      title: 'Un code de secours a servi à vous connecter',
      desc:
        'Une nouvelle série de codes de secours vous a été donnée, et les précédents ne fonctionnent plus. Si vous n’êtes pas à l’origine de cette connexion, prévenez l’administrateur de votre groupe.',
      reset: SIGN_IN.fr,
    },
    en: {
      title: 'A recovery code was used to sign you in',
      desc:
        'You were given a new set of recovery codes, and the previous ones no longer work. If you did not sign in, tell the administrator of your group.',
      reset: SIGN_IN.en,
    },
  },
};

/**
 * Sends one of the emails above. Never fails the request that sends it: an
 * email that cannot leave is logged.
 *
 * @param {Object} user the member
 * @param {string} name a key of TEXTS
 * @param {Object} [texts] the texts of an email not in TEXTS
 * @returns {Promise<void>}
 */
async function sendTwoFactorEmail(user, name, texts = TEXTS[name]) {
  const lang = texts[user.lang] ? user.lang : 'en';
  const url = `${siteOrigin()}/account/login`;
  try {
    await mail.send({
      to: user.email,
      subject: `${config.emailOptions.passwordSubjectPrefix} – ${SUBJECTS[lang]}`,
      text: `${texts[lang].title}. ${texts[lang].desc} ${url}`,
      html: renderEmail(texts, lang, { type: 'admin', url }),
    });
  } catch (error) {
    logger.error(`[two-factor] ${name} email failed for ${user.id}`, error);
  }
}

module.exports = { sendTwoFactorEmail, SUBJECTS, SIGN_IN };
