'use strict';

// The emails the platform sends about an account (docs/emails): the three
// about the password and the six about two-factor authentication. Each is
// read as it leaves, through the mocked transport, in French and in English,
// against the Badsender accessibility grid (docs/emails/audit-accessibilite.md).
// The decisions behind the expected values are recorded there too: short
// footer, LePatron brand, dark mode handled, French and English only.

jest.mock('../../../packages/server/mailing/mail.service.js', () => ({
  send: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
}));

const mongoose = require('mongoose');
const mail = require('../../../packages/server/mailing/mail.service.js');
const logger = require('../../../packages/server/utils/logger.js');
const config = require('../../../packages/server/node.config.js');
const UserSchema = require('../../../packages/server/user/user.schema.js');
const twoFactorEmails = require('../../../packages/server/two-factor/two-factor.emails.js');
const {
  sendEmailCode,
} = require('../../../packages/server/two-factor/email-code.js');

const User = mongoose.model('PlatformEmailsTest', UserSchema);

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

describe.each(CASES)('the %s email, in %s', (name, lang) => {
  let message;

  beforeAll(async () => {
    mail.send.mockClear();
    await EMAILS[name].send(lang);
    message = lastMessage();
  });

  const tag = (re) => (message.html.match(re) || [])[0];
  const h1 = () =>
    ((message.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '')
      .replace(/[ \t\r\n]+/g, ' ')
      .trim();

  it('declares its language on the document and on an enclosing div', () => {
    expect(tag(/<html[^>]*>/)).toMatch(new RegExp(`\\slang="${lang}"`));
    expect(tag(/<html[^>]*>/)).toMatch(new RegExp(`xml:lang="${lang}"`));
    expect(tag(/<div[^>]*role="article"[^>]*>/)).toMatch(
      new RegExp(`\\slang="${lang}"`)
    );
  });

  it('declares a reading direction', () => {
    expect(message.html).toMatch(/direction:\s*ltr/);
  });

  it('is titled after what it says', () => {
    const title = (message.html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    expect(title.replace(/[ \t\r\n]+/g, ' ').trim()).toBe(h1());
  });

  it('has one h1 and no other level that skips it', () => {
    expect(message.html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(message.html).not.toMatch(/<h[3-6][\s>]/);
  });

  it('sets a preheader that is not empty', () => {
    const preheader = message.html.match(
      /class="preheader"[^>]*>([\s\S]*?)<\/span>/
    );
    expect(preheader[1].trim().length).toBeGreaterThan(0);
  });

  it('reads in its own language only', () => {
    const visible = message.html
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ')
      // The address shown as a fallback has no language: /account/…/password/…
      .replace(/https?:\/\/\S+/g, ' ');
    expect(visible).toMatch(lang === 'fr' ? FRENCH_ONLY : ENGLISH_ONLY);
    expect(visible).not.toMatch(lang === 'fr' ? ENGLISH_ONLY : FRENCH_ONLY);
  });

  it('has a subject in its language, after the product name', () => {
    expect(
      message.subject.startsWith(
        `${config.emailOptions.passwordSubjectPrefix} – `
      )
    ).toBe(true);
    const own = message.subject.split(' – ')[1];
    expect(own).not.toMatch(lang === 'fr' ? ENGLISH_ONLY : FRENCH_ONLY);
  });

  it('has a plain text version that says what the page says', () => {
    const decoded = h1()
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    expect(message.text).toContain(decoded);
    if (EMAILS[name].cta) expect(message.text).toMatch(/https?:\/\//);
  });

  it('shows its layout tables as such', () => {
    const tables = message.html.match(/<table[^>]*>/g);
    expect(tables.filter((t) => !/role="presentation"/.test(t))).toEqual([]);
  });

  it('gives every image a text alternative and no title', () => {
    const images = message.html.match(/<img[^>]*>/g) || [];
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img).toMatch(/\salt="/);
      expect(img).not.toMatch(/\stitle="/);
    });
  });

  it('keeps a short footer, with no social icons and no marketing', () => {
    expect(message.html).not.toMatch(/facebook|twitter|linkedin|github/i);
    expect(message.html).not.toMatch(
      /détruire|zero ?carbon|delete this message/i
    );
    expect(message.html).toMatch(/mailto:|vie-privee|privacy/i);
    expect(message.html.length).toBeLessThan(15 * 1024);
  });

  it('sets its text at 14 px or more, with a line height of 150 % or more', () => {
    const styles = [
      ...message.html.matchAll(
        /font-size:\s*(\d+)px;\s*line-height:\s*(\d+)px/g
      ),
    ];
    expect(styles.length).toBeGreaterThan(0);
    // Every size set above 1 px (1 px hides the preheader) comes with its
    // line height: a reordered declaration cannot slip past the pairs.
    const sizes = [...message.html.matchAll(/font-size:\s*(\d+)px/g)].filter(
      ([, size]) => Number(size) > 1
    );
    expect(styles.filter(([, size]) => Number(size) > 1)).toHaveLength(
      sizes.length
    );
    styles
      .filter(([, size]) => Number(size) > 1)
      .forEach(([, size, line]) => {
        expect(Number(size)).toBeGreaterThanOrEqual(14);
        expect(Number(line) / Number(size)).toBeGreaterThanOrEqual(1.5);
      });
  });

  it('writes no text in capitals in its source, so a screen reader does not spell it', () => {
    const labels = [
      ...message.html.matchAll(/<a[^>]*>\s*([^<]+?)\s*<\/a>/g),
    ].map((m) => m[1]);
    labels.forEach((label) => {
      if (/[a-zà-ÿ]/i.test(label)) expect(label).not.toBe(label.toUpperCase());
    });
  });

  it('adapts to dark mode', () => {
    expect(message.html).toMatch(/name="color-scheme"/);
    expect(message.html).toMatch(/prefers-color-scheme:\s*dark/);
  });

  it('carries no script, no external stylesheet and no unused carousel', () => {
    expect(message.html).not.toMatch(/<script|<link[^>]+stylesheet/i);
    expect(message.html).not.toMatch(/carousel/);
  });

  if (EMAILS[name].cta) {
    it('leads to the sign-in or password page with a button that is clickable in full', () => {
      const [button] = message.html.match(
        /<a[^>]*href="https?:\/\/[^"]+"[^>]*display:\s*block[^>]*>/
      ) || [''];
      expect(button).not.toBe('');
      // The anchor is the whole button: block, with room to tap (44 px high
      // at 24 px of line and 10 px of padding or more, above and below).
      expect(button).toMatch(/padding:\s*(1\d|[2-9]\d)px/);
    });

    it('names where the button leads, not a bare "sign in" repeated everywhere', () => {
      const label = (message.html.match(
        /<a[^>]*display:\s*block[^>]*>\s*([^<]+?)\s*<\/a>/
      ) || [])[1];
      expect(label).toBeTruthy();
      expect(label).not.toMatch(
        /^(se connecter|sign in|cliquez ici|click here)$/i
      );
    });
  } else {
    it('has no button: there is nothing to do but type the code', () => {
      expect(message.html).not.toContain(LOGIN_URL);
    });
  }
});

describe('the welcome and the reset of a password', () => {
  const welcome = { fr: /bienvenue/i, en: /welcome/i };

  it.each(['fr', 'en'])(
    'welcomes an account that never had a password (%s)',
    async (lang) => {
      mail.send.mockClear();
      const user = member(lang);
      user.password = undefined;

      await user.resetPassword('admin', lang);

      expect(lastMessage().subject).toMatch(welcome[lang]);
      expect(lastMessage().html).toMatch(welcome[lang]);
    }
  );

  it.each([
    ['administrator', 'admin'],
    ['person', 'user'],
  ])(
    'does not welcome an account that had a password, reset by the %s',
    async (_by, type) => {
      mail.send.mockClear();

      await member('en').resetPassword(type, 'en');

      expect(lastMessage().subject).not.toMatch(welcome.en);
      expect(lastMessage().html).not.toMatch(welcome.en);
    }
  );

  // The password is already cleared and a link is out: the account is no
  // longer new, whatever asks for the next mail.
  it.each([
    ['an administrator sends it again', 'admin'],
    ['the person asks for a new one', 'user'],
  ])(
    'does not welcome an account whose first mail is out, when %s',
    async (_by, type) => {
      const user = member('fr');
      user.password = undefined;
      await user.resetPassword('admin', 'fr');
      expect(lastMessage().subject).toMatch(welcome.fr);

      await user.resetPassword(type, 'fr');

      expect(lastMessage().subject).not.toMatch(welcome.fr);
      expect(lastMessage().html).not.toMatch(/Un administrateur a créé/);
    }
  );

  it.each([
    ['fr', 'admin', /administrateur a réinitialisé/],
    ['en', 'admin', /administrator reset/],
    ['fr', 'user', /Vous avez demandé.*mot de passe actuel reste valable/],
    ['en', 'user', /You asked.*current password still works/],
  ])(
    'tells who asked: a reset in %s by %s says so',
    async (lang, type, wording) => {
      mail.send.mockClear();

      await member(lang).resetPassword(type, lang);

      expect(lastMessage().html).toMatch(wording);
    }
  );

  it('says the link lives 7 days, as long as it does', async () => {
    mail.send.mockClear();
    const user = member('en');

    await user.resetPassword('user', 'en');

    const days = (user.tokenExpire - Date.now()) / (24 * 60 * 60 * 1000);
    expect(Math.round(days)).toBe(7);
    expect(lastMessage().html).toMatch(/valid for 7 days/);
  });
});

describe('the text that comes from the outside', () => {
  it('escapes the browser and the system of a trusted device', async () => {
    mail.send.mockClear();

    await twoFactorEmails.sendTwoFactorEmail(
      member('en'),
      'deviceTrusted',
      twoFactorEmails.deviceTrustedTexts({
        browser: '<script>alert("x")</script>',
        os: '" onload="x',
      })
    );

    expect(lastMessage().html).not.toContain('<script>');
    expect(lastMessage().html).toContain('&lt;script&gt;');
    expect(lastMessage().html).not.toContain('" onload="x');
  });
});

describe('the language of the account, as it is stored', () => {
  it.each([
    ['FR', 'fr'],
    ['fr-FR', 'fr'],
    [' en_GB ', 'en'],
  ])('reads %p as %s without a warning', async (stored, language) => {
    mail.send.mockClear();
    logger.warn.mockClear();

    await twoFactorEmails.sendTwoFactorEmail(member(stored), 'setUp');

    expect(lastMessage().html).toMatch(
      new RegExp(`<html[^>]*\\slang="${language}"`)
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([[undefined], [null], ['']])(
    'writes in English, with nothing to log, when it is %p',
    async (stored) => {
      mail.send.mockClear();
      logger.warn.mockClear();

      await twoFactorEmails.sendTwoFactorEmail(member(stored), 'setUp');

      expect(lastMessage().html).toMatch(/<html[^>]*\slang="en"/);
      expect(logger.warn).not.toHaveBeenCalled();
    }
  );

  it('logs a value it does not know quoted and cut, not raw', async () => {
    logger.warn.mockClear();

    await twoFactorEmails.sendTwoFactorEmail(
      member('xx\nfake log line that goes on and on and on'),
      'setUp'
    );

    const [line] = logger.warn.mock.calls[0];
    expect(line).not.toMatch(/\n/);
    expect(line).not.toContain('goes on and on and on');
  });

  it('writes a password email in English too, for an untranslated language', async () => {
    mail.send.mockClear();

    await member('de').resetPassword('user', 'de');

    expect(lastMessage().html).toMatch(/<html[^>]*\slang="en"/);
    expect(lastMessage().subject).toMatch(/New password/);
  });
});

describe('a language the application does not translate', () => {
  it('writes in English, says so in the logs, and declares English', async () => {
    mail.send.mockClear();
    logger.warn.mockClear();

    await twoFactorEmails.sendTwoFactorEmail(member('de'), 'setUp');

    expect(lastMessage().html).toMatch(/<html[^>]*\slang="en"/);
    expect(lastMessage().subject).toMatch(/two-factor/i);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('de'));
  });
});
