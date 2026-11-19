'use strict';

// What the emails say of the account: a welcome or a reset, the language of the member, what comes from outside, the address of the images.
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

const mail = require('../../../packages/server/mailing/mail.service.js');
const logger = require('../../../packages/server/utils/logger.js');
const config = require('../../../packages/server/node.config.js');
const twoFactorEmails = require('../../../packages/server/two-factor/two-factor.emails.js');
const { lastMessage, member } = require('../../helpers/platform-emails.js');

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

  // The address is one segment of the link: a `+`, a `#` or a `/` in it
  // must not cut the link or end it early.
  it('encodes the address in the link, the `@` aside', async () => {
    mail.send.mockClear();
    const user = member('en');
    user.email = 'first+last#x/y@client.test';

    await user.resetPassword('user', 'en');

    const link = `/account/first%2Blast%23x%2Fy@client.test/password/${user.token}`;
    expect(lastMessage().text).toContain(link);
    expect(lastMessage().html).toContain(link);
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
