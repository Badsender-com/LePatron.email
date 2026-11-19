import { actions, mutations, GROUP_CHANGED } from '~/store/user.js';
import { ROLES } from '../../../packages/shared/access/roles.js';
import { userGettersOf, userOfRole, bootstrapAccount } from './user-getters.js';
import { canConnectApplications } from '~/helpers/module-activation.js';

// A company's settings saved, the sidebar follows: it reads the user's group,
// or the company a super admin selected (MODULES_GROUP), and offers the
// connected applications page as that company allows it.
function changeGroup(info, payload) {
  const state = { info };
  const commit = (type, value) => mutations[type](state, value);
  actions[GROUP_CHANGED]({ commit, state }, payload);
  return state.info;
}

const sidebarOffers = (info) =>
  canConnectApplications(userGettersOf(info).MODULES_GROUP);

const company = (id, extra = {}) => ({
  id,
  name: `Company ${id}`,
  enableMcpModule: true,
  enableMcp: false,
  ...extra,
});

describe('GROUP_CHANGED', () => {
  it("updates a user's own company", () => {
    const info = userOfRole(ROLES.GROUP_ADMIN_TECH, { group: company('g1') });

    const changed = changeGroup(info, {
      group: { id: 'g1' },
      changes: { enableMcp: true },
    });

    expect(changed.group).toEqual(company('g1', { enableMcp: true }));
    expect(sidebarOffers(info)).toBe(false);
    expect(sidebarOffers(changed)).toBe(true);
  });

  it("updates a super admin's selected company, not its own", () => {
    const info = userOfRole(ROLES.SUPER_ADMIN, {
      group: company('own'),
      selectedGroup: company('g2'),
    });

    const changed = changeGroup(info, {
      group: { id: 'g2' },
      changes: { enableMcp: true },
    });

    expect(changed.selectedGroup.enableMcp).toBe(true);
    expect(changed.group).toEqual(company('own'));
    expect(sidebarOffers(changed)).toBe(true);
  });

  it("updates the bootstrap account's selected company", () => {
    const info = bootstrapAccount({ selectedGroup: company('g2') });

    const changed = changeGroup(info, {
      group: { id: 'g2' },
      changes: { enableMcpModule: false },
    });

    expect(changed.selectedGroup.enableMcpModule).toBe(false);
  });

  it('matches a company known by its _id on either side', () => {
    const info = userOfRole(ROLES.GROUP_ADMIN_TECH, {
      group: { _id: 'g1', enableMcpModule: true, enableMcp: true },
    });

    const changed = changeGroup(info, {
      group: { id: 'g1' },
      changes: { enableMcp: false },
    });

    expect(changed.group.enableMcp).toBe(false);
    expect(
      changeGroup(changed, {
        group: { _id: 'g1' },
        changes: { enableMcp: true },
      }).group.enableMcp
    ).toBe(true);
  });

  it('leaves the store alone for another company', () => {
    const info = userOfRole(ROLES.SUPER_ADMIN, {
      group: company('own'),
      selectedGroup: company('g2'),
    });

    expect(
      changeGroup(info, { group: { id: 'g3' }, changes: { enableMcp: true } })
    ).toBe(info);
  });

  it('does nothing without a company id, or without a user', () => {
    const info = userOfRole(ROLES.GROUP_ADMIN_TECH, { group: {} });

    expect(changeGroup(info, { group: {}, changes: { enableMcp: true } })).toBe(
      info
    );
    expect(
      changeGroup(null, { group: { id: 'g1' }, changes: { enableMcp: true } })
    ).toBe(null);
  });
});
