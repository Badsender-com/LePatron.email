'use strict';

const { Groups } = require('../common/models.common.js');
const permissions = require('./permissions.js');
const { isSamlConfigured } = require('./saml-config.js');

/**
 * Whether the account signs in through its group's identity provider: its
 * group has a usable SSO (entry point, issuer and certificate). Such an
 * account has no password sign-in, so the identity provider's rules (its
 * second factor, a departure) hold in LePatron too.
 *
 * @param {Object} user a stored account
 * @returns {Promise<boolean>}
 */
async function signsInWithSso(user) {
  const groupId = permissions.groupIdOf(user);
  if (!groupId) return false;
  const group = await Groups.findOne(
    { _id: groupId },
    'entryPoint issuer idpCert'
  );
  return isSamlConfigured(group);
}

module.exports = { signsInWithSso };
