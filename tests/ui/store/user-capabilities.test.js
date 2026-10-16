import {
  actions,
  getters,
  CAN,
  USER_CAPABILITIES,
  IS_BOOTSTRAP_ACCOUNT,
  MODULES_GROUP,
  SELECT_GROUP,
  M_USER_SET,
} from '~/store/user.js';
import {
  ROLES,
  capabilitiesOfRole,
} from '../../../packages/shared/access/roles.js';
import { userGettersOf, userOfRole, bootstrapAccount } from './user-getters.js';

// The UI asks for a capability, as the server sent it with the user; it
// compares no role.
function storeOf(info) {
  const state = { info };
  const resolved = {};
  resolved[USER_CAPABILITIES] = getters[USER_CAPABILITIES](state);
  return { can: getters[CAN](state, resolved) };
}

describe('CAN', () => {
  it("answers from the user's capabilities", () => {
    const { can } = storeOf({ capabilities: capabilitiesOfRole('writer') });

    expect(can('mailing.edit-content')).toBe(true);
    expect(can('mailing.delete')).toBe(false);
  });

  it('refuses everything without a user, or without capabilities', () => {
    expect(storeOf(null).can('mailing.comment')).toBe(false);
    expect(storeOf({ role: 'regular_user' }).can('mailing.comment')).toBe(
      false
    );
  });

  it('throws on a misspelt capability instead of hiding for everyone', () => {
    expect(() => storeOf(null).can('mailing.remove')).toThrow();
  });
});

// The getters that tell where a user works, read from its capabilities.
describe('IS_BOOTSTRAP_ACCOUNT', () => {
  it('is the account that manages the platform without a role', () => {
    expect(userGettersOf(bootstrapAccount())[IS_BOOTSTRAP_ACCOUNT]).toBe(true);
  });

  it.each(Object.values(ROLES))('is not a %s', (role) => {
    expect(userGettersOf(userOfRole(role))[IS_BOOTSTRAP_ACCOUNT]).toBe(false);
  });

  it('is not an account stored before roles, nor a visitor', () => {
    const legacy = { capabilities: capabilitiesOfRole(ROLES.REGULAR_USER) };

    expect(userGettersOf(legacy)[IS_BOOTSTRAP_ACCOUNT]).toBe(false);
    expect(userGettersOf(null)[IS_BOOTSTRAP_ACCOUNT]).toBe(false);
  });
});

describe('MODULES_GROUP', () => {
  const own = { id: 'own' };
  const selected = { id: 'selected' };

  // Whoever manages the platform sees the group it selected, anyone else its
  // own group.
  const SEES_SELECTED = {
    [ROLES.SUPER_ADMIN]: true,
    [ROLES.GROUP_ADMIN_TECH]: false,
    [ROLES.GROUP_ADMIN]: false,
    [ROLES.REGULAR_USER]: false,
    [ROLES.WRITER]: false,
    [ROLES.REVIEWER]: false,
  };

  it('covers every role of the product', () => {
    expect(Object.keys(SEES_SELECTED).sort()).toEqual(
      Object.values(ROLES).slice().sort()
    );
  });

  it.each(Object.entries(SEES_SELECTED))(
    'for a %s, is the selected group: %s',
    (role, seesSelected) => {
      const info = userOfRole(role, { group: own, selectedGroup: selected });

      expect(userGettersOf(info)[MODULES_GROUP]).toBe(
        seesSelected ? selected : own
      );
    }
  );

  it("is the bootstrap account's selected group, none before it selects one", () => {
    expect(
      userGettersOf(bootstrapAccount({ selectedGroup: selected }))[
        MODULES_GROUP
      ]
    ).toBe(selected);
    expect(userGettersOf(bootstrapAccount())[MODULES_GROUP]).toBe(null);
  });

  it('is none without a user', () => {
    expect(userGettersOf(null)[MODULES_GROUP]).toBe(null);
  });
});

describe('SELECT_GROUP', () => {
  function selectAs(info) {
    const $put = jest.fn(() =>
      Promise.resolve({ selectedGroup: { id: 'g2' } })
    );
    const commit = jest.fn();
    const context = {
      commit,
      state: { info },
      getters: userGettersOf(info),
    };
    return actions[SELECT_GROUP].call(
      { $axios: { $put } },
      context,
      'g2'
    ).then(() => ({ $put, commit }));
  }

  it('selects a group for whoever manages the platform', async () => {
    const asSuperAdmin = await selectAs(userOfRole(ROLES.SUPER_ADMIN));
    const asBootstrap = await selectAs(bootstrapAccount());

    expect(asSuperAdmin.$put).toHaveBeenCalledTimes(1);
    expect(asBootstrap.$put).toHaveBeenCalledTimes(1);
    expect(asBootstrap.commit).toHaveBeenCalledWith(M_USER_SET, {
      selectedGroup: { id: 'g2' },
    });
  });

  it.each([
    ROLES.GROUP_ADMIN_TECH,
    ROLES.GROUP_ADMIN,
    ROLES.REGULAR_USER,
    ROLES.WRITER,
    ROLES.REVIEWER,
  ])('selects nothing for a %s', async (role) => {
    const { $put } = await selectAs(userOfRole(role));

    expect($put).not.toHaveBeenCalled();
  });

  it('selects nothing without a user', async () => {
    const { $put } = await selectAs(null);

    expect($put).not.toHaveBeenCalled();
  });
});
