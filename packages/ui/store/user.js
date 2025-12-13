import { groupsItem } from '~/helpers/api-routes.js';

export const USER = 'user';

export const state = () => ({
  info: null,
  hasFtpAccess: false,
});

export const LOCALE = 'LOCALE';
export const IS_CONNECTED = 'IS_CONNECTED';
export const IS_ADMIN = 'IS_ADMIN';
export const IS_GROUP_ADMIN = 'IS_GROUP_ADMIN';
export const SESSION_ACL = 'SESSION_ACL';
export const USER_SET_HAS_FTP_ACCESS = 'USER_SET_HAS_FTP_ACCESS';
export const HAS_FTP_ACCESS = 'HAS_FTP_ACCESS';

export const getters = {
  [IS_CONNECTED](state) {
    return state.info != null;
  },
  [IS_GROUP_ADMIN](state) {
    return state.info != null && state.info.isGroupAdmin === true;
  },
  [IS_ADMIN](state) {
    return state.info != null && state.info.isAdmin === true;
  },
  [LOCALE](state) {
    return state.info != null && state.info.lang;
  },
  [HAS_FTP_ACCESS]() {
    return state.hasFtpAccess;
  },
  [SESSION_ACL](state) {
    const hasSession = state.info != null;
    return {
      isConnected: hasSession,
      isUser:
        hasSession &&
        state.info.isAdmin !== true &&
        state.info.isGroupAdmin !== true,
      isAdmin: hasSession && state.info.isAdmin === true,
      isGroupAdmin: hasSession && state.info.isGroupAdmin === true,
    };
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
  [USER_SET_HAS_FTP_ACCESS](state, hasFtpAccess) {
    state.hasFtpAccess = hasFtpAccess;
  },
};

export const USER_SET = 'USER_SET';

export const actions = {
  async [USER_SET](vuexCtx, user) {
    const { commit } = vuexCtx;
    commit(M_USER_SET, user);

    // Only fetch group if user has a valid group ID
    const groupId = user && user.group && user.group.id;
    if (!groupId) {
      commit(USER_SET_HAS_FTP_ACCESS, false);
      return;
    }

    let group;
    try {
      group = await this.$axios.$get(groupsItem({ groupId }));
    } catch (error) {
      console.error('Error while fetching group:', error.message || error);
    }
    commit(
      USER_SET_HAS_FTP_ACCESS,
      !!(group && group.downloadMailingWithFtpImages)
    );
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
