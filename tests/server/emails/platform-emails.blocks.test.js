'use strict';

// The blocks of some emails: the benefits of the welcome, the code of the verification email, and the hosted images.
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

const fs = require('fs');
const path = require('path');
const config = require('../../../packages/server/node.config.js');
const {
  CASES,
  useEmail,
  IMAGES,
  contrast,
} = require('../../helpers/platform-emails.js');

describe.each(CASES)('the %s email, in %s', (name, lang) => {
  const { message, tag, h1 } = useEmail(name, lang);

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
});
