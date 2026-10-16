import { Roles } from '~/helpers/constants/roles.js';
import {
  mailActionOf,
  rowActionKeys,
  roleRank,
} from '~/helpers/user-row-actions.js';
import { capabilitiesOfRole } from '../../../packages/shared/access/roles.js';

// A row of the users table offers to manage an account only where the server
// accepts it; the page of the account stays reachable.
const as = (role) => capabilitiesOfRole(role);
const confirmed = (role) => ({ role, status: 'confirmed' });

describe('rowActionKeys', () => {
  it.each([
    [Roles.GROUP_ADMIN, Roles.WRITER, ['deactivate', 'mail-action', 'edit']],
    [
      Roles.GROUP_ADMIN,
      Roles.GROUP_ADMIN,
      ['deactivate', 'mail-action', 'edit'],
    ],
    [Roles.GROUP_ADMIN, Roles.GROUP_ADMIN_TECH, ['edit']],
    [
      Roles.GROUP_ADMIN_TECH,
      Roles.GROUP_ADMIN_TECH,
      ['deactivate', 'mail-action', 'edit'],
    ],
    [Roles.GROUP_ADMIN_TECH, Roles.SUPER_ADMIN, ['edit']],
    [
      Roles.SUPER_ADMIN,
      Roles.GROUP_ADMIN_TECH,
      ['deactivate', 'mail-action', 'edit'],
    ],
  ])('a %s, on a %s account: %j', (actor, role, expected) => {
    expect(rowActionKeys(confirmed(role), as(actor))).toEqual(expected);
  });

  it.each([
    ['deactivated', ['activate', 'edit']],
    ['to-be-initialized', ['mail-action', 'edit']],
    ['password-mail-sent', ['deactivate', 'mail-action', 'edit']],
    ['saml-authentication', ['deactivate', 'edit']],
  ])('follows the status of a manageable account: %s', (status, expected) => {
    expect(
      rowActionKeys({ role: Roles.WRITER, status }, as(Roles.GROUP_ADMIN))
    ).toEqual(expected);
  });

  it('offers only the page to someone who holds nothing', () => {
    expect(rowActionKeys(confirmed(Roles.REVIEWER), [])).toEqual(['edit']);
  });
});

describe('mailActionOf', () => {
  it.each([
    ['confirmed', 'resetPassword'],
    ['to-be-initialized', 'sendPassword'],
    ['password-mail-sent', 'reSendPassword'],
  ])('%s calls for %s', (status, action) => {
    expect(mailActionOf(status).action).toBe(action);
  });

  it('calls for none on a deactivated account', () => {
    expect(mailActionOf('deactivated')).toBeNull();
  });
});

describe('roleRank', () => {
  it('sorts every role, the most privileged first, an unknown one last', () => {
    const sorted = [...Object.values(Roles), 'owner'].sort(
      (a, b) => roleRank(a) - roleRank(b)
    );
    expect(sorted[0]).toBe(Roles.SUPER_ADMIN);
    expect(sorted[sorted.length - 1]).toBe('owner');
    expect(new Set(Object.values(Roles).map(roleRank)).size).toBe(
      Object.values(Roles).length
    );
  });
});
