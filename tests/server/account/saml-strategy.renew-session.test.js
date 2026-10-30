'use strict';

// Signing in through SSO opens a new session once the identity provider's
// response is valid; a refused response leaves the browser's session as it
// was.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: {},
  Groups: {},
}));
jest.mock('../../../packages/server/account/saml-account.js', () => ({
  samlOptionsForRequest: jest.fn(),
  accountOfResponse: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const passport = require('passport');
const {
  accountOfResponse,
} = require('../../../packages/server/account/saml-account.js');

require('../../../packages/server/account/auth.guard.js');

function requestWithSession() {
  const req = { session: {} };
  req.session.regenerate = jest.fn((done) => {
    req.session = { renewed: true };
    done();
  });
  return req;
}

function verify(req) {
  return new Promise((resolve) =>
    passport
      ._strategy('saml')
      ._verify(req, { nameID: 'someone@client.test' }, (error, user) =>
        resolve({ error, user })
      )
  );
}

describe('the SSO response', () => {
  it('opens a new session for the account it names', async () => {
    accountOfResponse.mockResolvedValue({ id: 'u1' });
    const req = requestWithSession();

    const { user } = await verify(req);

    expect(user).toEqual({ id: 'u1' });
    expect(req.session).toEqual({ renewed: true });
  });

  it('leaves the session as it was when it names no account', async () => {
    accountOfResponse.mockResolvedValue(null);
    const req = requestWithSession();
    const before = req.session;

    const { user } = await verify(req);

    expect(user).toBe(false);
    expect(req.session).toBe(before);
    expect(before.regenerate).not.toHaveBeenCalled();
  });
});
