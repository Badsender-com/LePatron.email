export const USER = `user`;

export const state = () => ({
  info: null,
});

export const LOCALE = `LOCALE`;
export const IS_CONNECTED = `IS_CONNECTED`;
export const IS_ADMIN = `IS_ADMIN`;
export const SESSION_ACL = `SESSION_ACL`;

export const getters = {
  [IS_CONNECTED](state) {
    return state.info != null;
  },
  [IS_ADMIN](state) {
    return state.info != null && state.info.isAdmin === true;
  },
  [LOCALE](state) {
    return state.info != null && state.info.lang;
  },
  [SESSION_ACL](state) {
    const hasSession = state.info != null;
    return {
      isConnected: hasSession,
      isUser: hasSession && state.info.isAdmin !== true,
      isAdmin: hasSession && state.info.isAdmin === true,
    };
  },
};

const M_USER_SET = `M_USER_SET`;

export const mutations = {
  [M_USER_SET](state, user) {
    state.info = {
      ...state.info,
      ...user,
    };
  },
};

export const USER_SET = `USER_SET`;

export const actions = {
  async [USER_SET](vuexCtx, user) {
    const { commit } = vuexCtx;
    commit(M_USER_SET, user);
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
