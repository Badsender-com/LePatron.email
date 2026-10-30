'use strict';

// An account's status reads its group's SSO as the sign-in does: entry
// point, issuer and certificate. Without the certificate the group signs in
// with a password, and the admin screens offer the password emails. The
// certificate is read for the status, never sent with the account.

jest.mock('../../../packages/server/mailing/mail.service.js', () => ({
  send: jest.fn(),
}));

const mongoose = require('mongoose');

const UserSchema = require('../../../packages/server/user/user.schema.js');
const GroupSchema = require('../../../packages/server/group/group.schema.js');

const {
  UserModel,
  GroupModel,
} = require('../../../packages/server/constant/model.names.js');

// Under their own names, so a group set on an account reads as populated.
const Users = mongoose.model(UserModel, UserSchema);
const Groups = mongoose.model(GroupModel, GroupSchema);

const SSO = {
  entryPoint: 'https://idp.client.test/sso',
  issuer: 'lepatron',
};

function memberOf(groupFields) {
  const group = new Groups({
    name: 'Client',
    status: 'active',
    ...groupFields,
  });
  const user = new Users({ email: 'someone@client.test', _company: group._id });
  user._company = group;
  user.password = 'a-password';
  return user;
}

describe('the status of a member', () => {
  it('is SSO when the group has its entry point, issuer and certificate', () => {
    expect(memberOf({ ...SSO, idpCert: 'MIIC-certificate' }).status).toBe(
      'saml-authentication'
    );
  });

  it('is a password one when the group has no certificate', () => {
    expect(memberOf(SSO).status).toBe('confirmed');
  });

  it('never carries the certificate in the answer', () => {
    const json = memberOf({ ...SSO, idpCert: 'MIIC-certificate' }).toJSON();

    expect(json.status).toBe('saml-authentication');
    expect(JSON.stringify(json)).not.toContain('MIIC-certificate');
    expect(json._company.entryPoint).toBe(SSO.entryPoint);
  });
});
