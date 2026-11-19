'use strict';

// Which password email an account gets: from what the account is (a
// password, a past sign-in) and who asks. The texts never claim a password
// the account does not have.

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
const {
  PASSWORD_TEXTS,
  passwordTextsFor,
} = require('../../../packages/server/email-templates/email-texts.js');
const { lastMessage, member } = require('../../helpers/platform-emails.js');

// The model the helper builds on the user schema.
const User = mongoose.model('PlatformEmailsTest');

const { welcome, reset, forgot } = PASSWORD_TEXTS;

describe('the text of a password email', () => {
  it.each([
    // hasPassword, hasSignedIn, askedBy, texts
    [false, false, 'admin', 'welcome', welcome],
    [false, false, 'user', 'welcome', welcome],
    [false, true, 'admin', 'reset', reset],
    [false, true, 'user', 'reset', reset],
    [true, true, 'admin', 'reset', reset],
    [true, true, 'user', 'forgot', forgot],
    [true, false, 'admin', 'reset', reset],
    [true, false, 'user', 'forgot', forgot],
  ])(
    'password %s, signed in %s, asked by %s: %s',
    (hasPassword, hasSignedIn, askedBy, _name, texts) => {
      expect(passwordTextsFor({ hasPassword, hasSignedIn, askedBy })).toBe(
        texts
      );
    }
  );

  it('says "your current password still works" only to an account that has one', () => {
    [false, true].forEach((hasSignedIn) =>
      ['admin', 'user'].forEach((askedBy) => {
        const texts = passwordTextsFor({
          hasPassword: false,
          hasSignedIn,
          askedBy,
        });
        expect(texts.fr.desc).not.toMatch(/reste valable/);
        expect(texts.en.desc).not.toMatch(/still works/);
      })
    );
  });
});

describe('the account, as the reset finds it', () => {
  const signedIn = (user) => {
    user.sessionMetadata = { loginTime: new Date() };
    return user;
  };

  it('tells a member whose password was removed that an administrator reset it, when they ask', async () => {
    const user = signedIn(member('fr'));
    user.password = undefined;

    await user.resetPassword('user', 'fr');

    expect(lastMessage().html).toMatch(/Un administrateur a réinitialisé/);
    expect(lastMessage().html).not.toMatch(/reste valable/);
  });

  it('tells a member back from a deactivation that an administrator reset it', async () => {
    const user = signedIn(member('en'));
    user.save = jest.fn().mockResolvedValue(user);
    await user.deactivate();
    await user.activate();

    await user.resetPassword('admin', 'en');

    expect(lastMessage().subject).not.toMatch(/welcome/i);
    expect(lastMessage().html).toMatch(/An administrator reset your password/);
  });

  // `sessionMetadata` is not loaded by default: a document that came without
  // it reads it from the database.
  it('reads the past sign-in when the document was loaded without it', async () => {
    const user = new User(
      { email: 'camille@client.test', name: 'Camille', lang: 'en' },
      { sessionMetadata: 0 }
    );
    user.save = jest.fn().mockResolvedValue(user);
    const lean = jest
      .fn()
      .mockResolvedValue({ sessionMetadata: { loginTime: new Date() } });
    const findById = jest
      .spyOn(User, 'findById')
      .mockReturnValue({ select: () => ({ lean }) });

    await user.resetPassword('user', 'en');

    expect(findById).toHaveBeenCalledWith(user._id);
    expect(lastMessage().html).toMatch(/An administrator reset your password/);
    findById.mockRestore();
  });
});
