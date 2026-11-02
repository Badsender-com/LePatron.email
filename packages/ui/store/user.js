import { groupsItem, selectedGroup } from '~/helpers/api-routes.js';
import { CAPABILITIES, assertCapability } from '../../shared/access/roles.js';

export const USER = 'user';

export const state = () => ({
  info: null,
});

export const LOCALE = 'LOCALE';
export const IS_CONNECTED = 'IS_CONNECTED';
// What the user may do, as the server sent it with the user
// (packages/shared/access/roles.js): `CAN(capability)`. The UI asks for a
// capability, never compares roles.
export const CAN = 'CAN';
export const USER_CAPABILITIES = 'USER_CAPABILITIES';
// Derived from the modules group's downloadMailingWithFtpImages. Used to be a
// separate boolean kept in sync via USER_SET_HAS_FTP_ACCESS — removed to
// keep one source of truth on the group document.
export const HAS_FTP_ACCESS = 'HAS_FTP_ACCESS';
export const GROUP = 'GROUP';
// The group a super admin works in (ADR 0002, amended), resolved by the
// server on every request; anyone else's own group.
export const SELECTED_GROUP = 'SELECTED_GROUP';
// The account defined by the deployment configuration: it manages the
// platform without holding a role, and stays in the settings (ADR 0002,
// amended).
export const IS_BOOTSTRAP_ACCOUNT = 'IS_BOOTSTRAP_ACCOUNT';
// The group whose modules the screens show, flags included: a super admin's
// selected group, anyone else's own group.
export const MODULES_GROUP = 'MODULES_GROUP';

export const getters = {
  [IS_CONNECTED](state) {
    return state.info != null;
  },
  [USER_CAPABILITIES](state) {
    return (state.info && state.info.capabilities) || [];
  },
  [CAN](state, getters) {
    const capabilities = getters[USER_CAPABILITIES];
    return (capability) => {
      assertCapability(capability);
      return capabilities.includes(capability);
    };
  },
  [LOCALE](state) {
    return state.info != null && state.info.lang;
  },
  [HAS_FTP_ACCESS](state, getters) {
    const group = getters[MODULES_GROUP];
    return !!(group && group.downloadMailingWithFtpImages);
  },
  [GROUP](state) {
    return state.info != null && state.info.group ? state.info.group : null;
  },
  [SELECTED_GROUP](state) {
    return (state.info && state.info.selectedGroup) || null;
  },
  [IS_BOOTSTRAP_ACCOUNT](state, getters) {
    return getters[CAN](CAPABILITIES.PLATFORM_MANAGE) && !state.info.role;
  },
  [MODULES_GROUP](state, getters) {
    if (!state.info) return null;
    return getters[CAN](CAPABILITIES.PLATFORM_MANAGE)
      ? state.info.selectedGroup || null
      : state.info.group || null;
  },
};

export const M_USER_SET = 'M_USER_SET';

export const mutations = {
  [M_USER_SET](state, user) {
    state.info = {
      ...state.info,
      ...user,
    };
  },
};

export const USER_SET = 'USER_SET';
export const SELECT_GROUP = 'SELECT_GROUP';

export const actions = {
  async [USER_SET](vuexCtx, user) {
    const { commit } = vuexCtx;
    commit(M_USER_SET, user);

    // Only fetch group if user has a valid group ID
    const groupId = user && user.group && user.group.id;
    if (!groupId) return;

    let group;
    try {
      group = await this.$axios.$get(groupsItem({ groupId }));
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[user store] Failed to fetch group:', error.message);
      }
    }

    // Update user info with complete group data (includes
    // enableEmailBuilder, enableCrmIntelligence, downloadMailingWithFtpImages,
    // ...). The HAS_FTP_ACCESS getter reads from here directly.
    if (group) {
      commit(M_USER_SET, { group });
    }
  },
  // A super admin, or the bootstrap account, selects the group it works in;
  // the server keeps it for the next requests and pages.
  async [SELECT_GROUP]({ commit, state, getters }, groupId) {
    if (!groupId || !getters[CAN](CAPABILITIES.PLATFORM_MANAGE)) return;
    const current = state.info.selectedGroup;
    if (current && String(current.id) === String(groupId)) return;
    const { selectedGroup: group } = await this.$axios.$put(selectedGroup(), {
      groupId,
    });
    commit(M_USER_SET, { selectedGroup: group });
  },
  // async [SET_LANG](vuexCtx, lang) {
  //     if (!SUPPORTED_LOCALES.includes(lang)) return
  //     const { commit } = vuexCtx;
  //     const { $axios } = this;
  //     // /language/:language
  //     commit(M_USER_SET_LANG, lang);
  //     $axios.$put(`/language/${lang}`)
  // },
};
