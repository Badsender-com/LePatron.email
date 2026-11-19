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
const path = require('path');
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

// Where the application hosts the images of the emails.
const IMAGES = path.join(__dirname, '../../../public/media/email');

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

  it('sets the description and the link at 16 px on a phone, as the card of the application', () => {
    expect(message.html).toMatch(
      /max-width:\s*480px[\s\S]*\.desc,\s*\.muted\s*\{\s*font-size:\s*16px/
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

  // The sign-in card of the application (its design system, and
  // packages/ui/components/account/auth-card.vue): the primary colour behind,
  // the white logo, a white card of 480 px with 10 px corners, a round icon, a
  // title in Inter 20 px / 600 in the primary colour. The brandbook is for what
  // speaks about LePatron (voice), not for what is inside the product.
  it('wears the sign-in card of the application', () => {
    expect(message.html).toMatch(/<body[^>]*background-color:\s*#093040/);
    expect(message.html).toMatch(/width:\s*480px/);
    expect(message.html).toMatch(/border-radius:\s*10px/);
    expect(tag(/<h1[^>]*>/)).toMatch(/color:\s*#093040/);
    expect(tag(/<h1[^>]*>/)).toMatch(/font-family:\s*'Inter'/);
    expect(tag(/<h1[^>]*>/)).toMatch(/font-size:\s*20px/);
    expect(tag(/<h1[^>]*>/)).toMatch(/font-weight:\s*600/);
    // The site's own type and ground stay on the site.
    expect(message.html).not.toMatch(/Fraunces|#fbf9f5/i);
    // The logo is above the card, on the backdrop: no band, no tagline.
    expect(message.html).toMatch(
      /<td align="center"[^>]*><img src="https?:\/\/[^"]+\/media\/email\/logo\.png"[^>]*>/
    );
  });

  // The backdrop is the glow of the sign-in screen, at the bottom right, over
  // the solid primary that a client drawing no gradient keeps (Outlook for
  // Windows). Its size is fixed, so that the footer text, the last thing in the
  // email, can be kept where it is readable whatever the height of the email.
  it('paints the backdrop with the glow of the sign-in screen, over the solid primary', () => {
    const cell = tag(/<td[^>]*class="backdrop"[^>]*>/);
    expect(cell).toMatch(
      /background-color:\s*#093040;\s*background-image:\s*radial-gradient\(circle \d+px at 100% 100%,\s*rgb\(0, 172, 220\) 0%,\s*rgb\(9, 48, 64\) 100%\)/
    );
    // The solid colour is also the attribute of the page table and the body.
    expect(message.html).toMatch(
      /<table[^>]*class="page"[^>]*bgcolor="#093040"/
    );
    expect(message.html).toMatch(/<body[^>]*background-color:\s*#093040/);
    // One gradient, on the backdrop only: never under the card.
    const markup = message.html.replace(/<style[\s\S]*?<\/style>/g, '');
    expect(markup.match(/gradient\(/g)).toHaveLength(1);
    expect(tag(/<table[^>]*class="card"[^>]*>/)).not.toMatch(/gradient/);
  });

  it('lets the backdrop fill the window where the client allows it, so the glow is not cut short', () => {
    // Without it the glow stops flat at the end of a short email, when the
    // window is taller than the email.
    expect(message.html).toMatch(/html, body \{ height: 100%; \}/);
    expect(tag(/<table[^>]*class="page"[^>]*>/)).toMatch(/\sheight="100%"/);
    expect(tag(/<table[^>]*class="page"[^>]*>/)).toMatch(/height:\s*100%/);
    expect(tag(/<div[^>]*role="article"[^>]*>/)).toMatch(/height:\s*100%/);
    expect(tag(/<td[^>]*class="backdrop"[^>]*>/)).toMatch(/valign="top"/);
  });

  it('keeps the footer text where the glow is dark enough to read it', () => {
    const cell = tag(/<td[^>]*class="backdrop"[^>]*>/);
    const radius = Number(/circle (\d+)px/.exec(cell)[1]);
    // The text is the last thing of the backdrop: its bottom is `padding-bottom`
    // from the corner of the glow, at the closest (a phone, text to the edge).
    const [, distance] = /padding:\s*\d+px \d+px (\d+)px \d+px/.exec(cell);
    // The colour of the glow at that distance: the accent fading to the
    // primary over the radius.
    const k = Math.min(1, Number(distance) / radius);
    const accent = [0, 172, 220];
    const primary = [9, 48, 64];
    const hex = accent
      .map((c, i) => Math.round(c * (1 - k) + primary[i] * k))
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('');
    const footer = tag(/<td[^>]*class="[^"]*footer[^"]*"[^>]*>/);
    const text = /color:\s*(#[0-9a-f]{6})/i.exec(footer)[1];
    expect(contrast(text, `#${hex}`)).toBeGreaterThanOrEqual(4.5);
    // And on the solid fallback.
    expect(contrast(text, '#093040')).toBeGreaterThanOrEqual(4.5);
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
    it('gives three reasons why LePatron is worth it, as a list, with the words of the application', () => {
      const list = message.html.match(/<ul[\s\S]*?<\/ul>/);
      expect(list).not.toBeNull();
      expect(list[0].match(/<li[\s>]/g)).toHaveLength(3);
      expect(list[0].match(/<strong/g)).toHaveLength(3);
      // A mailing is the object of the application; an email is an address.
      const words = list[0].replace(/<[^>]+>/g, ' ');
      expect(words).toMatch(/mailing/);
      expect(words).not.toMatch(/\bemails?\b/i);
    });

    it('shows them in a benefits block, a title over a picto and a sentence each', () => {
      const block = message.html.match(
        /<table[^>]*class="benefits"[\s\S]*?<\/ul>/
      )[0];
      // The block has its own title, a real heading, and keeps its list
      // semantics although the list has no bullets.
      expect(block).toMatch(/<h2[^>]*>[^<]+<\/h2>/);
      expect(message.html.match(/<h2[\s>]/g)).toHaveLength(1);
      expect(block).toMatch(/<ul role="list"/);
      // Each reason: a round icon that decorates (empty alt), hosted.
      const items = block.match(/<li[\s\S]*?<\/li>/g);
      expect(items).toHaveLength(3);
      const pictos = items.map((item) => {
        const [, src] = /<img src="([^"]+)" alt="" role="presentation"/.exec(
          item
        );
        expect(src).toMatch(
          /^https?:\/\/[^"]+\/media\/email\/icon-[a-z-]+\.png$/
        );
        return src;
      });
      // The pictos are not the card's: three different ones.
      expect(new Set(pictos).size).toBe(3);
    });

    it('keeps the block legible in dark mode', () => {
      const dark = message.html.match(
        /@media \(prefers-color-scheme: dark\)[\s\S]*?\n {4}\}/
      )[0];
      expect(dark).toMatch(
        /\.benefits\s*\{\s*background-color:\s*#0e2531\s*!important/
      );
      expect(contrast('#d1d5db', '#0e2531')).toBeGreaterThanOrEqual(4.5);
    });
  } else {
    it('has no list of reasons: it is not a welcome', () => {
      expect(message.html).not.toMatch(/<ul[\s>]/);
      expect(message.html).not.toMatch(/<h2[\s>]/);
      expect(message.html).not.toMatch(/class="benefits"/);
    });
  }

  if (name === 'code by email') {
    it('puts the code apart, in the code field style of the application, softly highlighted', () => {
      const code = /\b(\d{6})\b/.exec(message.text)[1];
      const cell = tag(/<td[^>]*class="code"[^>]*>/);
      expect(message.html).toMatch(
        new RegExp(`class="code"[^>]*>${code}</td>`)
      );
      expect(cell).toMatch(/font-family:\s*ui-monospace/);
      expect(cell).toMatch(/letter-spacing:\s*0\.3em/);
      expect(cell).toMatch(/font-size:\s*28px/);
      // The accent at 12 % over white (tint-accent), the text in the primary.
      expect(cell).toMatch(/background-color:\s*#e0f6fc/i);
      expect(contrast('#093040', '#e0f6fc')).toBeGreaterThanOrEqual(4.5);
      // Once in the page: the title and the subject no longer carry it.
      expect(message.html.match(new RegExp(code, 'g'))).toHaveLength(1);
      expect(h1()).not.toMatch(/\d/);
      expect(message.subject).not.toContain(code);
    });

    it('writes the code in the plain text, right after the title', () => {
      const code = /\b(\d{6})\b/.exec(message.text)[1];
      expect(message.text).toMatch(new RegExp(`${h1()}.{1,3}${code}`));
    });

    it('keeps the code legible in dark mode', () => {
      const dark = message.html.match(
        /@media \(prefers-color-scheme: dark\)[\s\S]*?\n {4}\}/
      )[0];
      expect(dark).toMatch(
        /\.code\s*\{\s*background-color:\s*#16394a\s*!important;\s*color:\s*#f3f4f6/
      );
      expect(contrast('#f3f4f6', '#16394a')).toBeGreaterThanOrEqual(4.5);
    });
  } else {
    it('has no code block: it carries no code', () => {
      expect(message.html).not.toMatch(/class="code"/);
    });
  }

  // The images are hosted by the application (public/media/email), linked by
  // an absolute address: no attachment, nothing inline.
  it('links its images by absolute addresses, to files the application hosts', () => {
    const images = [
      ...message.html.matchAll(/<img[^>]*\ssrc="([^"]+)"[^>]*>/g),
    ];
    // The logo, the icon of the card and, for a welcome, one icon a reason.
    expect(images).toHaveLength(name === 'password initialisation' ? 5 : 2);
    images.forEach(([, src]) => {
      expect(src).toMatch(
        new RegExp(`^https?://${config.host}/media/email/[a-z-]+\\.png$`)
      );
      expect(fs.existsSync(path.join(IMAGES, path.basename(src)))).toBe(true);
    });
    expect(message.html).not.toMatch(/cid:/);
    expect(message.attachments).toBeUndefined();
  });

  it('shows the logo with the name of the product and the icon of the card as a decoration', () => {
    const [logo, icon] = message.html.match(/<img[^>]*>/g);
    expect(logo).toMatch(/\/media\/email\/logo\.png"/);
    expect(logo).toMatch(/\salt="LePatron"/);
    expect(icon).toMatch(/\/media\/email\/icon-[a-z-]+\.png"/);
    expect(icon).toMatch(/\salt=""/);
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

    // White on the accent of the application is 2.7:1. Its design system
    // says: where accessibility is a hard requirement, the primary action
    // takes the primary colour (14:1 with white), and says so.
    it('puts the primary colour on the button, with a white text that can be read', () => {
      const cell = tag(/<td[^>]*class="cta"[^>]*>/);
      const link = tag(/<a[^>]*display:\s*block[^>]*>/);
      expect(cell).toMatch(/background-color:\s*#093040/i);
      expect(cell).toMatch(/border-radius:\s*5px/);
      const text = /color:\s*(#[0-9a-f]{6})/i.exec(link)[1];
      expect(text.toLowerCase()).toBe('#ffffff');
      expect(link).toMatch(/font-weight:\s*500/);
      // The grid asks 4.5:1 of the text of a button.
      expect(contrast(text, '#093040')).toBeGreaterThanOrEqual(4.5);
    });

    it('darkens the fill on hover, on the rounded cell and not on the link', () => {
      expect(message.html).toMatch(
        /\.cta:hover\s*\{\s*background-color:\s*#072530\s*!important/i
      );
      // A background on the link would paint square corners over the cell's.
      expect(tag(/<a[^>]*display:\s*block[^>]*>/)).not.toMatch(/background/);
      expect(message.html).not.toMatch(/(^|[\s,}])a:hover\s*\{[^}]*background/);
      expect(contrast('#ffffff', '#072530')).toBeGreaterThanOrEqual(4.5);
    });

    it('puts the action under a rule, on the right, as the card actions of the application', () => {
      expect(tag(/<td[^>]*class="[^"]*actions[^"]*"[^>]*>/)).toMatch(
        /text-align:\s*right/
      );
      expect(message.html).toMatch(/class="rule"[^>]*border-top:\s*1px solid/);
    });

    it('turns the button to the accent in dark mode, with a dark text, where the primary would vanish', () => {
      const dark = message.html.match(
        /@media \(prefers-color-scheme: dark\)[\s\S]*?\n {4}\}/
      )[0];
      expect(dark).toMatch(/\.card a[^{]*\{\s*color:\s*#7fd3f0/);
      expect(dark).toMatch(/\.card \.cta\s*\{\s*background-color:\s*#00acdc/);
      expect(dark).toMatch(
        /\.card \.cta a\s*\{\s*color:\s*#093040\s*!important/
      );
      expect(contrast('#093040', '#00acdc')).toBeGreaterThanOrEqual(4.5);
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

describe('the address of the images', () => {
  const { isDev } = config;
  afterEach(() => {
    config.isDev = isDev;
  });

  it.each([
    [true, 'http://'],
    [false, 'https://'],
  ])(
    'starts with the scheme of the site, as the links do (isDev %s: %s)',
    async (dev, scheme) => {
      config.isDev = dev;
      mail.send.mockClear();

      await member('en').resetPassword('user', 'en');

      const sources = [
        ...lastMessage().html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g),
      ].map(([, src]) => src);
      expect(sources.length).toBeGreaterThan(0);
      sources.forEach((src) =>
        expect(src.startsWith(`${scheme}${config.host}/media/email/`)).toBe(
          true
        )
      );
    }
  );
});
