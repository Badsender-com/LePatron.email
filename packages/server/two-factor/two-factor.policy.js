'use strict';

const { Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { isBootstrapAccount } = require('../account/bootstrap-account.js');
const { isSamlConfigured } = require('../account/saml-config.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

// What decides, in the group, whether its members need a second factor.
const GROUP_FIELDS = 'requireTwoFactor entryPoint issuer idpCert';

/**
 * Who signs in with a second factor (ADR 0008): every member of a group that
 * requires it, and every persisted super admin, whose account reaches every
 * group. The bootstrap account has no document to keep a secret in, and a
 * SAML group leaves it to its identity provider.
 *
 * @param {Object} user the account signing in
 * @param {Object|null} group its group, with GROUP_FIELDS
 * @returns {boolean}
 */
function isTwoFactorRequired(user, group) {
  if (!user || isBootstrapAccount(user)) return false;
  if (permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) return true;
  if (isSamlConfigured(group)) return false;
  return Boolean(group && group.requireTwoFactor === true);
}

/**
 * @param {Object} user the account signing in
 * @returns {Promise<boolean>}
 */
async function needsTwoFactor(user) {
  if (!user || isBootstrapAccount(user)) return false;
  const group = await Groups.findById(
    permissions.groupIdOf(user),
    GROUP_FIELDS
  ).lean();
  return isTwoFactorRequired(user, group);
}

module.exports = { isTwoFactorRequired, needsTwoFactor };
