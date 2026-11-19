'use strict';

// The look of each email, after the sign-in card of the application: the card, the backdrop and its glow, the button and its hover.
// The emails and what they share: tests/helpers/platform-emails.js.

jest.mock('../../../packages/server/mailing/mail.service.js', () => ({
  send: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
}));

const {
  CASES,
  useEmail,
  EMAILS,
  LOGIN_URL,
  contrast,
} = require('../../helpers/platform-emails.js');

describe.each(CASES)('the %s email, in %s', (name, lang) => {
  const { message, tag } = useEmail(name, lang);

  it('wears the sign-in card of the application', () => {
    expect(message.html).toMatch(/<body[^>]*background-color:\s*#093040/);
    // Fluid up to 480 px without a media query; a fixed table for Outlook.
    const wrap = tag(/<table[^>]*class="wrap"[^>]*>/);
    expect(wrap).toMatch(/\swidth="100%"/);
    expect(wrap).toMatch(/[\s;"]width:\s*100%/);
    expect(wrap).toMatch(/max-width:\s*480px/);
    expect(wrap).not.toMatch(/[\s;"]width:\s*480px/);
    expect(message.html).toMatch(
      /<!--\[if mso\]><table role="presentation" width="480"[^>]*><tr><td><!\[endif\]-->\s*<table[^>]*class="wrap"/
    );
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

  // The backdrop is the glow of the sign-in screen as it is, over the solid
  // primary that a client drawing no gradient keeps (Outlook for Windows). Up
  // to the tablet breakpoint of the application the glow is off: the footer text
  // sits on it there, and falls under 4.5:1.
  it('paints the backdrop with the glow of the sign-in screen, over the solid primary', () => {
    const cell = tag(/<td[^>]*class="backdrop"[^>]*>/);
    expect(cell).toMatch(
      /background-color:\s*#093040;\s*background-image:\s*radial-gradient\(at 100% 100%,\s*rgb\(0, 172, 220\) 0%,\s*rgb\(9, 48, 64\) 50%\)/
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

  it('turns the glow off up to the tablet breakpoint of the application, leaving the solid primary', () => {
    expect(message.html).toMatch(
      /@media only screen and \(max-width: 960px\) \{\s*\.backdrop \{ background-image: none !important; \}/
    );
  });

  // Where the glow is on, the white footer text must be 4.5:1 on it. The glow
  // is the CSS ellipse of the sign-in screen: farthest corner, so radii of the
  // box sides times the square root of 2; the accent at 0 %, the primary at
  // 50 %. The text is the last thing of the box, its right end `(W - 480) / 2 +
  // 4` px from the corner, its bottom `H - footerBottom` px above it.
  it('keeps the white footer text 4.5:1 on the glow, from the first width where it is on', () => {
    const [, breakpoint] = /max-width: (\d+)px\) \{\s*\.backdrop/.exec(
      message.html
    );
    const accent = [0, 172, 220];
    const primary = [9, 48, 64];
    const hex = (k) =>
      `#${accent
        .map((c, i) => Math.round(c * (1 - k) + primary[i] * k))
        .map((c) => c.toString(16).padStart(2, '0'))
        .join('')}`;
    const width = Number(breakpoint) + 1;
    // The shortest emails are the ones that bring the text closest to the
    // glow; windows from 500 to 1600 px high.
    let worst = Infinity;
    [450, 640, 934].forEach((footerBottom) => {
      for (let window = 500; window <= 1600; window += 25) {
        const height = Math.max(footerBottom + 40, window);
        const dx = (width - 480) / 2 + 4;
        const dy = height - footerBottom;
        const d = Math.hypot(
          dx / (width * Math.SQRT2),
          dy / (height * Math.SQRT2)
        );
        worst = Math.min(worst, contrast('#ffffff', hex(Math.min(1, d / 0.5))));
      }
    });
    expect(worst).toBeGreaterThanOrEqual(4.5);
    const footer = tag(/<td[^>]*class="[^"]*footer[^"]*"[^>]*>/);
    expect(/color:\s*(#[0-9a-f]{6})/i.exec(footer)[1].toLowerCase()).toBe(
      '#ffffff'
    );
    // And on the solid primary, where the glow is off or not drawn.
    expect(contrast('#ffffff', '#093040')).toBeGreaterThanOrEqual(4.5);
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

  it('speaks of the platform, not only of an email builder', () => {
    const visible = message.html
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ');
    [visible, message.text, message.subject].forEach((text) =>
      expect(text).not.toMatch(/email builder/i)
    );
    // The default of the code, whatever a local .lepatronrc or the
    // environment says: the configuration read without them.
    jest.isolateModules(() => {
      jest.doMock('rc', () => (_name, defaults) => defaults);
      const defaults = require('../../../packages/server/node.config.js');
      expect(defaults.emailOptions.passwordSubjectPrefix).toBe('LePatron');
    });
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
