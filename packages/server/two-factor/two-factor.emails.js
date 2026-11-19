'use strict';

const logger = require('../utils/logger.js');
const mail = require('../mailing/mail.service.js');
const {
  composeEmail,
  resolveLanguage,
  siteOrigin,
} = require('../email-templates/email-template.js');

// The emails that tell a member about their two-factor authentication
// (ADR 0008). None names who acted: the security event keeps that.

const SUBJECTS = {
  fr: 'Double authentification',
  en: 'Two-factor authentication',
};

const OPEN = { fr: 'Ouvrir LePatron', en: 'Open LePatron' };

const TEXTS = {
  reset: {
    fr: {
      subject: SUBJECTS.fr,
      title: 'Votre double authentification est réinitialisée',
      preheader: 'Vous la configurerez de nouveau à votre prochaine connexion.',
      desc:
        'Vous la configurerez de nouveau à votre prochaine connexion. Si vous n’attendiez pas ce changement, prévenez l’administrateur technique de votre société.',
      button: OPEN.fr,
    },
    en: {
      subject: SUBJECTS.en,
      title: 'Your two-factor authentication is reset',
      preheader: 'You will set it up again at your next sign-in.',
      desc:
        'You will set it up again at your next sign-in. If you did not expect this change, tell your company’s technical administrator.',
      button: OPEN.en,
    },
  },
  // Sent to the previous address of a member whose emailed method was reset
  // by the change of their address.
  emailChanged: {
    fr: {
      subject: SUBJECTS.fr,
      title: 'L’adresse de votre compte a changé',
      preheader: 'Votre double authentification est réinitialisée.',
      desc:
        'Votre compte utilise désormais une autre adresse email, et votre double authentification est réinitialisée. Si vous n’attendiez pas ce changement, prévenez tout de suite l’administrateur technique de votre société.',
      button: OPEN.fr,
    },
    en: {
      subject: SUBJECTS.en,
      title: 'The address of your account has changed',
      preheader: 'Your two-factor authentication is reset.',
      desc:
        'Your account now uses another email address, and your two-factor authentication is reset. If you did not expect this change, tell your company’s technical administrator straight away.',
      button: OPEN.en,
    },
  },
  setUp: {
    fr: {
      subject: SUBJECTS.fr,
      title: 'La double authentification est activée sur votre compte',
      preheader: 'Vous saisirez un code après votre mot de passe.',
      desc:
        'Vous saisirez désormais un code après votre mot de passe. Si vous ne l’avez pas configurée vous-même, prévenez tout de suite l’administrateur technique de votre société.',
      button: OPEN.fr,
    },
    en: {
      subject: SUBJECTS.en,
      title: 'Two-factor authentication is on for your account',
      preheader: 'You will enter a code after your password.',
      desc:
        'You will now enter a code after your password. If you did not set it up yourself, tell your company’s technical administrator straight away.',
      button: OPEN.en,
    },
  },
  recoveryCodeUsed: {
    fr: {
      subject: SUBJECTS.fr,
      title: 'Connexion avec un code de secours',
      preheader: 'Une nouvelle série de codes de secours est disponible.',
      desc:
        'Vous avez reçu une nouvelle série de codes de secours\u00a0: les précédents ne fonctionnent plus. Si vous ne vous êtes pas connecté, prévenez l’administrateur technique de votre société.',
      button: OPEN.fr,
    },
    en: {
      subject: SUBJECTS.en,
      title: 'Sign-in with a recovery code',
      preheader: 'A new set of recovery codes is available.',
      desc:
        'You received a new set of recovery codes: the previous ones no longer work. If you did not sign in, tell your company’s technical administrator.',
      button: OPEN.en,
    },
  },
  deviceTrusted: {
    fr: {
      subject: SUBJECTS.fr,
      title: 'Un nouvel appareil de confiance',
      preheader: 'Cet appareil ne demandera plus de code pendant 30 jours.',
      desc:
        'Cet appareil ne vous demandera plus de code pendant 30 jours. Si vous ne l’avez pas mémorisé vous-même, prévenez l’administrateur technique de votre société.',
      button: OPEN.fr,
    },
    en: {
      subject: SUBJECTS.en,
      title: 'A new trusted device',
      preheader: 'This device will not ask for a code for 30 days.',
      desc:
        'This device will not ask you for a code for 30 days. If you did not trust it yourself, tell your company’s technical administrator.',
      button: OPEN.en,
    },
  },
};

/**
 * The texts of the "new trusted device" email, naming the device.
 *
 * @param {{browser: string, os: string}} device
 * @returns {Object}
 */
function deviceTrustedTexts({ browser, os }) {
  const texts = {};
  Object.entries(TEXTS.deviceTrusted).forEach(([lang, text]) => {
    // A no-break space before the colon in French only.
    const colon = lang === 'fr' ? '\u00a0: ' : ': ';
    texts[lang] = { ...text, title: `${text.title}${colon}${browser}, ${os}` };
  });
  return texts;
}

/**
 * Sends one of the emails above. Never fails the request that sends it: an
 * email that cannot leave is logged.
 *
 * @param {Object} user the member
 * @param {string} name a key of TEXTS
 * @param {Object} [texts] the texts of an email not in TEXTS; one without a
 *   `button` has none, nothing to do but read it
 * @returns {Promise<void>}
 */
async function sendTwoFactorEmail(user, name, texts = TEXTS[name]) {
  const lang = resolveLanguage(user.lang);
  // A button leads to the sign-in page; an email without one has no link.
  const url = texts[lang].button ? `${siteOrigin()}/account/login` : undefined;
  try {
    await mail.send({
      to: user.email,
      ...composeEmail(texts, lang, { url }),
    });
  } catch (error) {
    logger.error(`[two-factor] ${name} email failed for ${user.id}`, error);
  }
}

module.exports = { sendTwoFactorEmail, deviceTrustedTexts, SUBJECTS };
