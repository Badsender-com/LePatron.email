import Vue from 'vue';
import VueI18n from 'vue-i18n';

import { SUPPORTED_LOCALES, messages } from '~/helpers/locales/index.js';
// import numberFormats from '~/locales/number-formats'
// import dateTimeFormats from '~/locales/date-time-formats'
import { USER, LOCALE } from '~/store/user';
import { PAGE, DEFAULT_LOCALE } from '~/store/page';

import Vuelidate from 'vuelidate';
Vue.use(Vuelidate);
Vue.use(VueI18n);

export default ({ app, store }) => {
  // Set i18n instance on app
  // This way we can use it in middleware and pages asyncData/fetch
  app.i18n = new VueI18n({
    locale:
      store.getters[`${USER}/${LOCALE}`] ||
      store.getters[`${PAGE}/${DEFAULT_LOCALE}`],
    fallbackLocale: SUPPORTED_LOCALES[0],
    fallbackRoot: true,
    silentTranslationWarn: true,
    messages,
    // numberFormats,
    // dateTimeFormats,
  });

  // https://vuex.vuejs.org/api/#watch
  store.watch(
    (state) => store.getters[`${USER}/${LOCALE}`],
    (userLocale) => {
      if (userLocale) {
        app.i18n.locale = userLocale;
      }
    }
  );

  store.watch(
    (state) => store.getters[`${PAGE}/${DEFAULT_LOCALE}`],
    (appLocale) => {
      app.i18n.locale = store.getters[`${USER}/${LOCALE}`] || appLocale;
    }
  );
};
