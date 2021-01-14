import Vue from 'vue';
import _ from 'lodash';
import { SUPPORTED_LOCALES } from '~/helpers/locales/index.js';
import { PAGE, SET_PAGE_LANG } from '~/store/page';

export default ({ app, store }) => {
  const browserLocal = getBrowserLocal() || SUPPORTED_LOCALES[0];
  store.commit(`${PAGE}/${SET_PAGE_LANG}`, browserLocal);
};

const getBrowserLocal = () => {
  const browserLocal = (navigator.languages !== undefined
    ? navigator.languages[0]
    : navigator.language
  ).split('-')[0];

  return _.indexOf(SUPPORTED_LOCALES, browserLocal) !== -1 && browserLocal;
};
