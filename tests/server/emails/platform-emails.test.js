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

const fs = require('fs');
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
    // Read per style attribute: whatever the order of the declarations, each
    // size above 1 px (1 px hides the preheader) has a line height of its own.
    const texts = [...message.html.matchAll(/style="([^"]*)"/g)]
      .map(([, style]) => style)
      .filter((style) => /font-size:\s*(\d+)px/.test(style))
      .map((style) => ({
        size: Number(/font-size:\s*(\d+)px/.exec(style)[1]),
        line: Number((/line-height:\s*(\d+)px/.exec(style) || [])[1]),
      }))
      .filter(({ size }) => size > 1);
    expect(texts.length).toBeGreaterThan(0);
    texts.forEach(({ size, line }) => {
      expect(size).toBeGreaterThanOrEqual(14);
      expect(line / size).toBeGreaterThanOrEqual(1.5);
    });
  });

  it('sets the link at 16 px on a phone, where the text is already at 16', () => {
    expect(message.html).toMatch(
      /max-width:\s*560px[\s\S]*\.muted\s*\{\s*font-size:\s*16px/
    );
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

  // The identity of lepatron.email (its tokens: --c-toile, --c-encre,
  // --c-safran, Fraunces for the titles): the canvas behind a white card under
  // an ink band that carries the logo, the title in Fraunces, the saffron for
  // the action. No brandbook of the product was found: the live site is the
  // reference.
  it('wears the identity of lepatron.email', () => {
    expect(message.html).toMatch(/<body[^>]*background-color:\s*#fbf9f5/);
    expect(message.html).toMatch(/width:\s*520px/);
    expect(message.html).toMatch(/border-radius:\s*10px/);
    expect(tag(/<h1[^>]*>/)).toMatch(/color:\s*#093040/);
    expect(tag(/<h1[^>]*>/)).toMatch(/font-family:\s*'Fraunces',\s*Georgia/);
    expect(tag(/<h1[^>]*>/)).toMatch(/font-weight:\s*500/);
    expect(message.html).toMatch(/font-family:\s*'Inter'/);
    // The logo is white, on the ink band.
    expect(message.html).toMatch(
      /bgcolor="#093040"[^>]*>\s*<img src="cid:logo@/
    );
  });

  it('speaks of the platform, not only of an email builder', () => {
    const visible = message.html
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ');
    [visible, message.text, message.subject].forEach((text) =>
      expect(text).not.toMatch(/email builder/i)
    );
    expect(config.emailOptions.passwordSubjectPrefix).not.toMatch(/builder/i);
  });

  if (name === 'password initialisation') {
    it('gives three reasons why LePatron is worth it, as a list', () => {
      const list = message.html.match(/<ul[\s\S]*?<\/ul>/);
      expect(list).not.toBeNull();
      expect(list[0].match(/<li[\s>]/g)).toHaveLength(3);
      expect(list[0].match(/<strong/g)).toHaveLength(3);
    });
  } else {
    it('has no list of reasons: it is not a welcome', () => {
      expect(message.html).not.toMatch(/<ul[\s>]/);
    });
  }

  it('shows the logo and the icon of the card, which travel with the email', () => {
    const logo = message.attachments.find(({ cid }) => /^logo@/.test(cid));
    const icon = message.attachments.find(({ cid }) => /^icon@/.test(cid));
    expect(message.attachments).toHaveLength(2);
    [logo, icon].forEach((file) => {
      expect(fs.existsSync(file.path)).toBe(true);
      expect(file.contentDisposition).toBe('inline');
      expect(message.html).toContain(`src="cid:${file.cid}"`);
    });
    // The logo names the product; the round icon only decorates.
    expect(tag(new RegExp(`<img[^>]*cid:${logo.cid}[^>]*>`))).toMatch(
      /\salt="LePatron"/
    );
    expect(tag(new RegExp(`<img[^>]*cid:${icon.cid}[^>]*>`))).toMatch(
      /\salt=""/
    );
  });

  it('never loads an image from the application, which a mail client may not reach', () => {
    const sources = [...message.html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)];
    sources.forEach(([, src]) => expect(src).toMatch(/^cid:/));
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

    it('puts the saffron of the brand on the button, with an ink text that can be read', () => {
      const cell = tag(/<td[^>]*class="cta"[^>]*>/);
      const link = tag(/<a[^>]*display:\s*block[^>]*>/);
      expect(cell).toMatch(/background-color:\s*#ffb400/i);
      expect(cell).toMatch(/border-radius:\s*5px/);
      const text = /color:\s*(#[0-9a-f]{6})/i.exec(link)[1];
      expect(text.toLowerCase()).toBe('#093040');
      // The grid asks 4.5:1 of the text of a button.
      expect(contrast(text, '#ffb400')).toBeGreaterThanOrEqual(4.5);
    });

    it('turns the button ink on hover, as the site does, on the rounded cell and not on the link', () => {
      expect(message.html).toMatch(
        /\.cta:hover\s*\{\s*background-color:\s*#093040\s*!important/i
      );
      expect(message.html).toMatch(
        /\.cta:hover a\s*\{\s*color:\s*#ffffff\s*!important/i
      );
      // A background on the link would paint square corners over the cell's.
      expect(tag(/<a[^>]*display:\s*block[^>]*>/)).not.toMatch(/background/);
      expect(message.html).not.toMatch(/(^|[\s,}])a:hover\s*\{[^}]*background/);
      expect(contrast('#ffffff', '#093040')).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the ink text on the saffron button in dark mode, where links turn light', () => {
      const dark = message.html.match(
        /@media \(prefers-color-scheme: dark\)[\s\S]*?\n {4}\}/
      )[0];
      expect(dark).toMatch(/\.card a[^{]*\{\s*color:\s*#7fd3f0/);
      expect(dark).toMatch(
        /\.card \.cta a\s*\{\s*color:\s*#093040\s*!important/
      );
      // The dashed motif is ink: it would vanish on the dark card.
      expect(dark).toMatch(/\.dash\s*\{\s*border-bottom-color:\s*#cfdbe1/);
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
