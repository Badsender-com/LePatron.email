import { templates } from '~/helpers/api-routes';

import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export const TEMPLATE = 'template';
export const SET_TEMPLATES = 'SET_TEMPLATES';
export const FETCH_TEMPLATES = 'FETCH_TEMPLATES';
export const SET_TEMPLATES_LOADING = 'SET_TEMPLATES_LOADING';

export const state = () => ({
  templates: {},
  templatesLoading: false,
});

export const getters = {};

// https://medium.com/vuetify/creating-reusable-snackbars-with-vuetify-and-vuex-a8c3fef7b206
export const mutations = {
  [SET_TEMPLATES](store, templates) {
    store.templates = templates;
  },
  [SET_TEMPLATES_LOADING](store, templateLoading) {
    store.templatesLoading = templateLoading;
  },
};

export const actions = {
  async [FETCH_TEMPLATES]({ commit }, { $t } = {}) {
    let templatesData;
    commit(SET_TEMPLATES_LOADING, false);
    try {
      const { $axios } = this;
      try {
        const { items } = await $axios.$get(templates());
        templatesData = items;
        commit(SET_TEMPLATES, templatesData);
      } catch (error) {
        this.templateIsError = true;
      } finally {
        commit(SET_TEMPLATES_LOADING, false);
      }
    } catch {
      if ($t) {
        commit(
          `${PAGE}/${SHOW_SNACKBAR}`,
          {
            text: $t('global.errors.errorOccured'),
            color: 'error',
          },
          { root: true }
        );
      }
    }
  },
};
