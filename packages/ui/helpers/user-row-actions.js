import { getStatusActions } from '~/helpers/user-status.js';
import { CAPABILITIES } from '../../shared/access/roles.js';
import { Roles, canManageAccount } from '~/helpers/constants/roles';

// One pastel chip per role (light background, darker text of the same hue):
// red for every admin, yellow for the roles that review or write, grey for the
// regular user. Listed from the most to the least privileged, which is also
// the sort order of the column.
const ADMIN_CHIP = { color: 'red lighten-4', textColor: 'red darken-3' };
const REVIEW_WRITE_CHIP = {
  color: 'amber lighten-4',
  textColor: 'brown darken-2',
};
const ROLE_CHIPS = {
  [Roles.SUPER_ADMIN]: ADMIN_CHIP,
  [Roles.GROUP_ADMIN]: ADMIN_CHIP,
  [Roles.GROUP_ADMIN_TECH]: ADMIN_CHIP,
  [Roles.REVIEWER]: REVIEW_WRITE_CHIP,
  [Roles.WRITER]: REVIEW_WRITE_CHIP,
  [Roles.REGULAR_USER]: { color: 'grey lighten-3', textColor: 'grey darken-2' },
};
const ROLE_ORDER = Object.keys(ROLE_CHIPS);

export const roleChip = (role) =>
  ROLE_CHIPS[role] || ROLE_CHIPS[Roles.REGULAR_USER];

export const roleRank = (role) => {
  const rank = ROLE_ORDER.indexOf(role);
  return rank === -1 ? ROLE_ORDER.length : rank;
};

// The password mail an account's status calls for, with the i18n key of its
// tooltip (BsRowActions translates it).
const MAIL_ACTIONS = [
  { action: 'resetPassword', textKey: 'users.passwordTooltip.reset' },
  { action: 'sendPassword', textKey: 'users.passwordTooltip.send' },
  { action: 'reSendPassword', textKey: 'users.passwordTooltip.resend' },
];

/**
 * @param {string} status the account's
 * @returns {{action: string, textKey: string}|null}
 */
export function mailActionOf(status) {
  const actions = getStatusActions(status);
  return MAIL_ACTIONS.find(({ action }) => actions[action]) || null;
}

/**
 * The actions a row of the users table offers, in order. Managing the account
 * (status, password mail) is offered only where the server accepts it: nobody
 * manages an account with more rights than their own. Its page is always
 * reachable, and read-only then.
 *
 * @param {Object} account the row's
 * @param {string[]} capabilities the actor's
 * @returns {string[]} among activate, deactivate, mail-action,
 *   two-factor-reset, edit
 */
export function rowActionKeys(account, capabilities) {
  const keys = [];
  if (canManageAccount(capabilities, account)) {
    if (getStatusActions(account.status).activate) keys.push('activate');
    else if (account.status !== 'to-be-initialized') keys.push('deactivate');
    if (mailActionOf(account.status)) keys.push('mail-action');
    // Only a setup can be reset, by a tech admin or a super admin (ADR 0008).
    if (
      account.twoFactorMethod &&
      capabilities.includes(CAPABILITIES.GROUP_MANAGE_TECH)
    ) {
      keys.push('two-factor-reset');
    }
  }
  keys.push('edit');
  return keys;
}
