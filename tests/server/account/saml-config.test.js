'use strict';

// SSO is only an authentication when the identity provider's signature is
// checked, and passport-saml 2.x checks it only when it is given a certificate.
// These pin the two halves of that: a company without a certificate never gets
// SSO options, and a response passport-saml receives with them must carry the
// IdP's signature.

const { SAML } = require('passport-saml/lib/passport-saml/saml.js');

const {
  normalizeIdpCert,
  isSamlConfigured,
  samlOptionsFor,
} = require('../../../packages/server/account/saml-config.js');
const { createIdp } = require('../../helpers/saml-idp.js');

const idp = createIdp();
const configured = {
  entryPoint: 'https://idp.example.test/sso',
  issuer: 'lepatron',
  idpCert: idp.certPem,
};

const pemBody = (pem) => pem.replace(/-----[^-]+-----|\s/g, '');

describe('normalizeIdpCert', () => {
  it('keeps a PEM certificate', () => {
    expect(pemBody(normalizeIdpCert(idp.certPem))).toBe(pemBody(idp.certPem));
  });

  // Identity providers show the certificate both ways in their metadata.
  it('accepts the bare base64 body', () => {
    expect(pemBody(normalizeIdpCert(pemBody(idp.certPem)))).toBe(
      pemBody(idp.certPem)
    );
  });

  it('clears the field on an empty value', () => {
    expect(normalizeIdpCert('')).toBe('');
    expect(normalizeIdpCert('   ')).toBe('');
    expect(normalizeIdpCert(null)).toBe('');
  });

  // A typo here would otherwise only show as every SSO login failing.
  it.each([
    ['text', 'not a certificate'],
    ['a truncated certificate', idp.certPem.slice(0, 200)],
    ['a non-string', { cert: 'x' }],
  ])('refuses %s', (_label, value) => {
    expect(() => normalizeIdpCert(value)).toThrow(
      expect.objectContaining({ status: 400, message: 'INVALID_IDP_CERT' })
    );
  });
});

describe('samlOptionsFor', () => {
  it('passes the certificate to passport-saml', () => {
    expect(samlOptionsFor(configured)).toEqual({
      entryPoint: configured.entryPoint,
      issuer: configured.issuer,
      cert: idp.certPem,
    });
  });

  it.each([
    ['no certificate', { ...configured, idpCert: '' }],
    ['no entry point', { ...configured, entryPoint: '' }],
    ['no issuer', { ...configured, issuer: undefined }],
    ['no company', undefined],
  ])('gives no options with %s', (_label, group) => {
    expect(samlOptionsFor(group)).toBeNull();
    expect(isSamlConfigured(group)).toBe(false);
  });
});

describe('passport-saml with the options samlOptionsFor gives', () => {
  const saml = new SAML({
    ...samlOptionsFor(configured),
    callbackUrl: 'http://localhost/SAML-login/callback',
  });

  const validate = (xml) =>
    new Promise((resolve) => {
      saml.validatePostResponse(
        { SAMLResponse: Buffer.from(xml).toString('base64') },
        (error, profile) => resolve({ error, profile })
      );
    });

  it('accepts a response signed by the identity provider', async () => {
    const { error, profile } = await validate(
      idp.signedResponse('user@client.test')
    );
    expect(error).toBeNull();
    expect(profile.nameID).toBe('user@client.test');
  });

  it('refuses a response the identity provider did not sign', async () => {
    const { error } = await validate(idp.response('user@client.test'));
    expect(error).toEqual(expect.any(Error));
  });

  it('refuses a signed response altered afterwards', async () => {
    const altered = idp
      .signedResponse('user@client.test')
      .replace('user@client.test', 'other@client.test');
    const { error } = await validate(altered);
    expect(error).toEqual(expect.any(Error));
  });

  it('refuses a response signed by another identity provider', async () => {
    const { error } = await validate(
      createIdp().signedResponse('user@client.test')
    );
    expect(error).toEqual(expect.any(Error));
  });
});

// The group controller runs every certificate through normalizeIdpCert, on
// creation and on update: a malformed one is refused with a 400 instead of
// being stored and breaking every SSO login of the company.
describe('group controller — the identity provider certificate', () => {
  jest.resetModules();
  jest.doMock('../../../packages/server/group/group.service.js', () => ({
    updateGroup: jest.fn(),
  }));
  jest.doMock('../../../packages/server/common/models.common.js', () => ({
    Groups: {
      findById: jest.fn().mockResolvedValue({ id: 'g1' }),
    },
    Profiles: {},
    Templates: {},
    Mailings: {},
  }));
  jest.doMock(
    '../../../packages/server/profile/profile.service.js',
    () => ({})
  );
  jest.doMock(
    '../../../packages/server/emails-group/emails-group.service.js',
    () => ({})
  );
  jest.doMock(
    '../../../packages/server/personalized-variables/personalized-variable.service.js',
    () => ({})
  );
  jest.doMock('../../../packages/server/group/group-ftp.service.js', () => ({
    processCredentialsForUpdate: jest.fn((body) => ({ ...body })),
    validateSshKeyOrThrow: jest.fn(),
    maskFtpCredentials: jest.fn((group) => group),
  }));
  jest.doMock(
    '../../../packages/server/workspace/workspace.service.js',
    () => ({
      createWorkspace: jest.fn(),
      findWorkspaces: jest.fn(),
    })
  );

  const groupService = require('../../../packages/server/group/group.service.js');
  const groupController = require('../../../packages/server/group/group.controller.js');
  const superAdmin = { isAdmin: true, isGroupAdmin: false };

  const update = (body) =>
    new Promise((resolve) => {
      groupController.update(
        { params: { groupId: 'g1' }, body, user: superAdmin },
        { json: () => resolve(null) },
        resolve
      );
    });

  beforeEach(() => groupService.updateGroup.mockClear());

  it('stores a valid certificate as PEM', async () => {
    expect(await update({ idpCert: pemBody(idp.certPem) })).toBeNull();
    const stored = groupService.updateGroup.mock.calls[0][0].idpCert;
    expect(stored).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(pemBody(stored)).toBe(pemBody(idp.certPem));
  });

  it('refuses a malformed certificate, and stores nothing', async () => {
    const error = await update({ idpCert: 'not a certificate' });
    expect(error).toMatchObject({ status: 400, message: 'INVALID_IDP_CERT' });
    expect(groupService.updateGroup).not.toHaveBeenCalled();
  });
});
