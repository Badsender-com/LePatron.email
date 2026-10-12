'use strict';

// The login page asks this endpoint whether to send the user to their company's
// SSO or to show the password field. SSO is offered only when it can be
// verified: a company without its identity provider's certificate would get an
// SSO that checks no signature, so it signs in with a password instead.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: { findOne: jest.fn() },
  Groups: { findOne: jest.fn() },
  Mailings: {},
}));
jest.mock('../../../packages/server/user/user.service.js', () => ({}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Users,
  Groups,
} = require('../../../packages/server/common/models.common.js');
const controller = require('../../../packages/server/user/user.controller.js');
const { createIdp } = require('../../helpers/saml-idp.js');

const idp = createIdp();

function publicProfile(group) {
  Users.findOne.mockResolvedValue({
    email: 'user@client.test',
    name: 'User',
    isDeactivated: false,
    group: 'g1',
  });
  Groups.findOne.mockResolvedValue(group);
  return new Promise((resolve, reject) => {
    controller.getPublicProfile(
      { params: { username: 'user@client.test' } },
      { json: resolve },
      reject
    );
  });
}

describe('GET public profile — whether the login page offers SSO', () => {
  const sso = {
    name: 'Client',
    entryPoint: 'https://idp.example.test/sso',
    issuer: 'lepatron',
    idpCert: idp.certPem,
  };

  it('offers SSO to a company whose certificate is configured', async () => {
    const profile = await publicProfile(sso);
    expect(profile.group).toEqual({
      name: 'Client',
      isSAMLAuthentication: true,
    });
  });

  it('falls back to the password without a certificate', async () => {
    const profile = await publicProfile({ ...sso, idpCert: '' });
    expect(profile.group.isSAMLAuthentication).toBe(false);
  });

  it('falls back to the password without SSO at all', async () => {
    const profile = await publicProfile({ name: 'Client' });
    expect(profile.group.isSAMLAuthentication).toBe(false);
  });

  it('never ships the certificate or the SSO settings', async () => {
    const profile = await publicProfile(sso);
    expect(Object.keys(profile.group).sort()).toEqual([
      'isSAMLAuthentication',
      'name',
    ]);
  });
});
