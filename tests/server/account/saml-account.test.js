'use strict';

// SSO signs a person in through the identity provider of their own company,
// and only that one: a response is checked against the certificate of the
// company of the account it names, whatever the query string says, and the
// account signed in must belong to the company whose certificate checked it.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: { findOne: jest.fn() },
  Groups: { findOne: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { SAML } = require('@node-saml/node-saml');

const {
  Users,
  Groups,
} = require('../../../packages/server/common/models.common.js');
const {
  nameIdOf,
  samlOptionsForRequest,
  accountOfResponse,
  samlCallbackBody,
  refusedSamlResponse,
} = require('../../../packages/server/account/saml-account.js');
const { createIdp } = require('../../helpers/saml-idp.js');

const idpOfX = createIdp();
const idpOfY = createIdp();

const COMPANIES = [
  {
    _id: 'company-x',
    entryPoint: 'https://idp.x.test/sso',
    issuer: 'lepatron',
    idpCert: idpOfX.certPem,
  },
  {
    _id: 'company-y',
    entryPoint: 'https://idp.y.test/sso',
    issuer: 'lepatron',
    idpCert: idpOfY.certPem,
  },
];
const ACCOUNTS = [
  { _id: 'u-x', email: 'someone@x.test', _company: 'company-x' },
  { _id: 'u-y', email: 'someone@y.test', _company: 'company-y' },
  { _id: 'u-k', email: 'kate@x.test', _company: 'company-x' },
];

beforeEach(() => {
  Users.findOne.mockImplementation(
    async ({ email }) => ACCOUNTS.find((a) => a.email === email) || null
  );
  Groups.findOne.mockImplementation(
    async ({ _id }) => COMPANIES.find((c) => c._id === _id) || null
  );
});

const base64 = (xml) => Buffer.from(xml).toString('base64');

// What the strategy does on the callback: options for the request, the
// response checked with them, then the account it signs in.
async function signInWith(xml, query = {}) {
  const req = { query, body: { SAMLResponse: base64(xml) } };
  let options;
  try {
    options = await samlOptionsForRequest(req);
  } catch (error) {
    return { error };
  }
  const { error, profile } = await new SAML(options)
    .validatePostResponseAsync(req.body)
    .then(
      (result) => ({ profile: result.profile }),
      (err) => ({ error: err })
    );
  if (error) return { error };
  return { user: await accountOfResponse(req, profile) };
}

describe('signing in through SSO', () => {
  it('signs in an account with a response of its own identity provider', async () => {
    const { user, error } = await signInWith(
      idpOfY.signedResponse('someone@y.test')
    );

    expect(error).toBeUndefined();
    expect(user._id).toBe('u-y');
  });

  it("refuses an account named by another company's identity provider", async () => {
    const { user, error } = await signInWith(
      idpOfX.signedResponse('someone@y.test')
    );

    expect(user).toBeUndefined();
    expect(error).toEqual(expect.any(Error));
  });

  it('picks the certificate from the response, never from the query string', async () => {
    const { user, error } = await signInWith(
      idpOfX.signedResponse('someone@y.test'),
      { email: 'someone@x.test' }
    );

    expect(user).toBeUndefined();
    expect(error).toEqual(expect.any(Error));
  });

  it('refuses an account outside the company whose certificate checked the response', async () => {
    const req = { samlCompanyId: 'company-x' };

    expect(
      await accountOfResponse(req, { nameID: 'someone@y.test' })
    ).toBeNull();
  });

  it('refuses a NameID that only matches an account through a non-ASCII letter', async () => {
    const kelvin = '\u212Aate@x.test';

    expect(
      await accountOfResponse(
        { samlCompanyId: 'company-x' },
        { nameID: kelvin }
      )
    ).toBeNull();
  });

  it('signs in an account with a pending password reset', async () => {
    const { user } = await signInWith(idpOfY.signedResponse('someone@y.test'));

    expect(user._id).toBe('u-y');
    expect(Users.findOne.mock.calls[0][0]).not.toHaveProperty('token');
  });

  it('refuses a response before any company was picked', async () => {
    expect(await accountOfResponse({}, { nameID: 'someone@y.test' })).toBe(
      null
    );
  });
});

describe('starting a sign-in', () => {
  it('picks the identity provider of the account the login page names', async () => {
    const req = { query: { email: 'Someone@X.test' }, body: {} };

    const options = await samlOptionsForRequest(req);

    expect(options.entryPoint).toBe('https://idp.x.test/sso');
    expect(req.samlCompanyId).toBe('company-x');
  });

  it('refuses an unknown account', async () => {
    await expect(
      samlOptionsForRequest({ query: { email: 'nobody@z.test' }, body: {} })
    ).rejects.toThrow('SAML provider not found');
  });
});

describe('nameIdOf', () => {
  it('reads the NameID whatever the namespace prefixes', () => {
    const xml =
      '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">' +
      '<saml:Assertion><saml:Subject>' +
      '<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">someone@y.test</saml:NameID>' +
      '</saml:Subject></saml:Assertion></samlp:Response>';

    expect(nameIdOf(base64(xml))).toBe('someone@y.test');
  });

  it('reads nothing from a response carrying several assertions', () => {
    const assertion = (email) =>
      `<saml2:Assertion><saml2:Subject><saml2:NameID>${email}</saml2:NameID></saml2:Subject></saml2:Assertion>`;
    const xml =
      '<saml2p:Response xmlns:saml2p="p" xmlns:saml2="a">' +
      assertion('someone@x.test') +
      assertion('someone@y.test') +
      '</saml2p:Response>';

    expect(nameIdOf(base64(xml))).toBeUndefined();
  });

  it('decodes the entities of the NameID, and expands no DOCTYPE entity', () => {
    const xml =
      '<!DOCTYPE r [<!ENTITY x "expanded">]>' +
      '<samlp:Response xmlns:samlp="p" xmlns:saml="a"><saml:Assertion><saml:Subject>' +
      '<saml:NameID>o&apos;brien&amp;co&#39;s&x;@y.test</saml:NameID>' +
      '</saml:Subject></saml:Assertion></samlp:Response>';

    expect(nameIdOf(base64(xml))).toBe("o'brien&co's&x;@y.test");
  });

  it('reads nothing from an oversized response', () => {
    expect(nameIdOf('A'.repeat(256 * 1024 + 1))).toBeUndefined();
  });

  it('reads nothing from something that is not a response', () => {
    expect(nameIdOf('not base64 xml')).toBeUndefined();
  });
});

// The identity provider posts its response as a form, the only form the
// application reads outside the editor's rename.
describe('samlCallbackBody', () => {
  const express = require('express');
  const request = require('../../helpers/local-request.js');

  function app() {
    const server = express();
    server.post('/callback', samlCallbackBody, (req, res) =>
      res.json({ length: (req.body.SAMLResponse || '').length })
    );
    server.use((err, _req, res, _next) => res.sendStatus(err.status || 500));
    return server;
  }

  it('reads a response as large as one that is read', async () => {
    const samlResponse = 'A'.repeat(256 * 1024);

    const res = await request(app())
      .post('/callback')
      .type('form')
      .send({ SAMLResponse: samlResponse, RelayState: '/' });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(samlResponse.length);
  });

  it('refuses a form far larger than any response', async () => {
    const res = await request(app())
      .post('/callback')
      .type('form')
      .send({ SAMLResponse: 'A'.repeat(2 * 1024 * 1024) });

    expect(res.status).toBe(413);
  });
});

// A response the SAML library refuses (a wrong audience, a bad signature)
// sends the browser back to the application, as a response naming no account
// does; the reason is logged, never the response itself.
describe('refusedSamlResponse', () => {
  const logger = require('../../../packages/server/utils/logger.js');

  it('redirects to the login page, which says it failed, and logs why', () => {
    const res = { redirect: jest.fn() };
    const next = jest.fn();
    const samlResponse = base64(idpOfX.signedResponse('someone@x.test'));

    refusedSamlResponse(
      new Error('SAML assertion audience mismatch'),
      { body: { SAMLResponse: samlResponse } },
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalledWith('/account/login?sso=failed');
    expect(next).not.toHaveBeenCalled();
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).toContain('SAML assertion audience mismatch');
    expect(logged).not.toContain(samlResponse);
    expect(logged).not.toContain('someone@x.test');
  });
});
