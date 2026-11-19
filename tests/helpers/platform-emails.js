'use strict';

// What the tests of the emails the platform sends about an account share
// (docs/emails): the ten emails by the way they leave, in French and in
// English, read through the mocked transport. The `jest.mock` of the
// transport and of the logger stay in each test file: they are hoisted there,
// before this file is required.

const path = require('path');
const mongoose = require('mongoose');
const mail = require('../../packages/server/mailing/mail.service.js');
const config = require('../../packages/server/node.config.js');
const UserSchema = require('../../packages/server/user/user.schema.js');
const twoFactorEmails = require('../../packages/server/two-factor/two-factor.emails.js');
const {
  sendEmailCode,
} = require('../../packages/server/two-factor/email-code.js');

const User = mongoose.model('PlatformEmailsTest', UserSchema);

// The contrast of WCAG 2: computed here, from the colours, and not read from
// the code under test.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Where the application hosts the images of the emails.
const IMAGES = path.join(__dirname, '../../public/media/email');

const LOGIN_URL = `https://${config.host}/account/login`;

// A member with a password, the one every email but the welcome is sent to.
function member(lang) {
  const user = new User({
    email: 'dominique@client.test',
    name: 'Dominique',
    password: 'current-password',
    lang,
  });
  user.save = jest.fn().mockResolvedValue(user);
  return user;
}

const lastMessage = () =>
  mail.send.mock.calls[mail.send.mock.calls.length - 1][0];

// Each email, by the way it leaves. `title` is what the page announces, `cta`
// whether a button leads somewhere useful (the code email has none: there is
// nothing to do but type the code).
const EMAILS = {
  'password initialisation': {
    cta: true,
    send: (lang) => {
      const user = member(lang);
      user.password = undefined;
      return user.resetPassword('admin', lang);
    },
  },
  'password reset by an administrator': {
    cta: true,
    send: (lang) => member(lang).resetPassword('admin', lang),
  },
  'forgotten password': {
    cta: true,
    send: (lang) => member(lang).resetPassword('user', lang),
  },
  'password reset confirmation': {
    cta: true,
    send: (lang) => member(lang).setPassword('new-password', lang),
  },
  'code by email': {
    cta: false,
    send: (lang) => sendEmailCode({}, member(lang)),
  },
  'two-factor authentication set up': {
    cta: true,
    send: (lang) => twoFactorEmails.sendTwoFactorEmail(member(lang), 'setUp'),
  },
  'two-factor authentication reset': {
    cta: true,
    send: (lang) => twoFactorEmails.sendTwoFactorEmail(member(lang), 'reset'),
  },
  'address of the account changed': {
    cta: true,
    send: (lang) =>
      twoFactorEmails.sendTwoFactorEmail(member(lang), 'emailChanged'),
  },
  'recovery code used': {
    cta: true,
    send: (lang) =>
      twoFactorEmails.sendTwoFactorEmail(member(lang), 'recoveryCodeUsed'),
  },
  'new trusted device': {
    cta: true,
    send: (lang) =>
      twoFactorEmails.sendTwoFactorEmail(
        member(lang),
        'deviceTrusted',
        twoFactorEmails.deviceTrustedTexts({
          browser: 'Firefox 130',
          os: 'Linux',
        })
      ),
  },
};

// What a French or English reader must be able to tell apart, said once.
const FRENCH_ONLY = /\b(votre|vous|mot de passe|connexion|compte)\b/i;
const ENGLISH_ONLY = /\b(your|you|password|sign in|account)\b/i;

const CASES = Object.keys(EMAILS).flatMap((name) => [
  [name, 'fr'],
  [name, 'en'],
]);

/**
 * Sends one email in a language, before the tests of its describe, and gives
 * what they read: its message (subject, text, html), `tag` (the first match
 * of a pattern in its HTML) and `h1` (its title, as the page says it).
 */
function useEmail(name, lang) {
  let sent;

  beforeAll(async () => {
    mail.send.mockClear();
    await EMAILS[name].send(lang);
    sent = lastMessage();
  });

  const message = {
    get html() {
      return sent.html;
    },
    get text() {
      return sent.text;
    },
    get subject() {
      return sent.subject;
    },
    get attachments() {
      return sent.attachments;
    },
  };
  const tag = (re) => (sent.html.match(re) || [])[0];
  const h1 = () =>
    ((sent.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '')
      .replace(/[ \t\r\n]+/g, ' ')
      .trim();

  return { message, tag, h1 };
}

module.exports = {
  CASES,
  EMAILS,
  ENGLISH_ONLY,
  FRENCH_ONLY,
  IMAGES,
  LOGIN_URL,
  contrast,
  lastMessage,
  member,
  useEmail,
};
