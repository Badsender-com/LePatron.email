export const PAGE = `page`;

export const SET_PAGE_TITLE = `SET_PAGE_TITLE`;
export const SET_PAGE_LANG = `SET_PAGE_LANG`;
export const SHOW_SNACKBAR = `SHOW_SNACKBAR`;
export const CLOSE_SNACKBAR = `CLOSE_SNACKBAR`;
export const DEFAULT_LOCALE = `DEFAULT_LOCALE`;

export const state = () => ({
  pageTitle: `Default Title`,
  lang: null,
  snackbar: {
    color: `info`,
    visible: false,
    text: ``,
    timeout: 6000,
    multiline: false,
  },
});

export const getters = {
  [DEFAULT_LOCALE](state) {
    return state.lang;
  },
};

// https://medium.com/vuetify/creating-reusable-snackbars-with-vuetify-and-vuex-a8c3fef7b206
export const mutations = {
  [SET_PAGE_TITLE](state, title) {
    state.pageTitle = title;
  },
  [SET_PAGE_LANG](state, lang) {
    state.lang = lang;
  },
  [SHOW_SNACKBAR](state, payload) {
    if (payload.text == null) return;
    state.snackbar.text = payload.text;
    state.snackbar.multiline = payload.text.length > 50 ? true : false;
    if (payload.multiline) state.snackbar.multiline = payload.multiline;
    if (payload.timeout) state.snackbar.timeout = payload.timeout;
    state.snackbar.color = payload.color;
    state.snackbar.visible = true;
  },
  [CLOSE_SNACKBAR](state) {
    state.snackbar.visible = false;
    state.snackbar.multiline = false;
    state.snackbar.timeout = 6000;
    state.snackbar.text = ``;
  },
};
