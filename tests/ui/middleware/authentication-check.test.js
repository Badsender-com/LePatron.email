import authMiddleware from '~/middleware/authentication-check.js';
import * as acls from '~/helpers/pages-acls.js';
import { ROLES } from '../../../packages/shared/access/roles.js';
import {
  storeOf,
  userOfRole,
  bootstrapAccount,
} from '../store/user-getters.js';

// A page names what it needs in `meta.acl`; the middleware grants it from the
// capabilities the server sent with the user, and compares no role. The table
// is the access each visitor had when the pages were guarded by role, which
// the capabilities keep.

const LOGIN = '/account/login';
const GRANTED = 'granted';

function visit(info, acl) {
  const redirect = jest.fn((path) => path);
  const result = authMiddleware({
    store: storeOf(info),
    redirect,
    route: { meta: [{ acl }] },
  });
  return result.then(() =>
    redirect.mock.calls.length ? redirect.mock.calls[0][0] : GRANTED
  );
}

const VISITORS = {
  'signed out': null,
  bootstrap: bootstrapAccount(),
  [ROLES.SUPER_ADMIN]: userOfRole(ROLES.SUPER_ADMIN),
  [ROLES.GROUP_ADMIN_TECH]: userOfRole(ROLES.GROUP_ADMIN_TECH),
  [ROLES.GROUP_ADMIN]: userOfRole(ROLES.GROUP_ADMIN),
  [ROLES.REGULAR_USER]: userOfRole(ROLES.REGULAR_USER),
  [ROLES.WRITER]: userOfRole(ROLES.WRITER),
  [ROLES.REVIEWER]: userOfRole(ROLES.REVIEWER),
  'account stored before roles': {
    id: 'legacy-id',
    capabilities: userOfRole(ROLES.REGULAR_USER).capabilities,
  },
};

const ACLS = {
  ACL_NOT_CONNECTED: acls.ACL_NOT_CONNECTED,
  ACL_USER: acls.ACL_USER,
  ACL_PLATFORM_MANAGE: acls.ACL_PLATFORM_MANAGE,
  ACL_GROUP_MANAGE: acls.ACL_GROUP_MANAGE,
  ACL_GROUP_MANAGE_TECH: acls.ACL_GROUP_MANAGE_TECH,
  ACL_OWN_GROUP_MANAGE: acls.ACL_OWN_GROUP_MANAGE,
};

// Columns in the order of ACLS.
const EXPECTED = {
  'signed out': [GRANTED, LOGIN, LOGIN, LOGIN, LOGIN, LOGIN],
  bootstrap: ['/groups', GRANTED, GRANTED, GRANTED, GRANTED, LOGIN],
  [ROLES.SUPER_ADMIN]: ['/', GRANTED, GRANTED, GRANTED, GRANTED, LOGIN],
  [ROLES.GROUP_ADMIN_TECH]: ['/', GRANTED, LOGIN, GRANTED, GRANTED, GRANTED],
  [ROLES.GROUP_ADMIN]: ['/', GRANTED, LOGIN, GRANTED, LOGIN, GRANTED],
  [ROLES.REGULAR_USER]: ['/', GRANTED, LOGIN, LOGIN, LOGIN, LOGIN],
  [ROLES.WRITER]: ['/', GRANTED, LOGIN, LOGIN, LOGIN, LOGIN],
  [ROLES.REVIEWER]: ['/', GRANTED, LOGIN, LOGIN, LOGIN, LOGIN],
  'account stored before roles': ['/', GRANTED, LOGIN, LOGIN, LOGIN, LOGIN],
};

describe('authentication-check', () => {
  it('covers every role of the product', () => {
    Object.values(ROLES).forEach((role) => {
      expect(VISITORS).toHaveProperty([role]);
      expect(EXPECTED).toHaveProperty([role]);
    });
  });

  const cases = [];
  Object.keys(VISITORS).forEach((visitor) => {
    Object.keys(ACLS).forEach((aclName, index) => {
      cases.push([visitor, aclName, EXPECTED[visitor][index]]);
    });
  });

  it.each(cases)(
    'a %s on an %s page: %s',
    async (visitor, aclName, outcome) => {
      expect(await visit(VISITORS[visitor], ACLS[aclName])).toBe(outcome);
    }
  );

  it('grants a page listing several needs on any of them', async () => {
    const acl = [acls.ACL_PLATFORM_MANAGE, acls.ACL_GROUP_MANAGE_TECH];

    expect(await visit(userOfRole(ROLES.GROUP_ADMIN_TECH), acl)).toBe(GRANTED);
    expect(await visit(userOfRole(ROLES.SUPER_ADMIN), acl)).toBe(GRANTED);
    expect(await visit(userOfRole(ROLES.GROUP_ADMIN), acl)).toBe(LOGIN);
  });

  it('grants a page without an acl to nobody', async () => {
    expect(await visit(userOfRole(ROLES.SUPER_ADMIN), undefined)).toBe(LOGIN);
    expect(await visit(null, undefined)).toBe(LOGIN);
  });

  it('reads the acl of the page among the merged route metas', async () => {
    const redirect = jest.fn((path) => path);
    await authMiddleware({
      store: storeOf(userOfRole(ROLES.REGULAR_USER)),
      redirect,
      route: { meta: [{}, { acl: acls.ACL_PLATFORM_MANAGE }] },
    });

    expect(redirect).toHaveBeenCalledWith(LOGIN);
  });
});
