'use strict';

// Vuetify's own texts (a field's clear button, "Chargement…") come from the
// installed Vuetify, in the app's language.

const nuxtConfig = require('../../../nuxt.config.js');

describe("Vuetify's texts", () => {
  it.each(['fr', 'en'])('has the texts of the fields in %s', (locale) => {
    const texts = nuxtConfig.vuetify.lang.locales[locale];

    expect(texts.input.clear).toEqual(expect.any(String));
    expect(texts.loading).toEqual(expect.any(String));
  });

  it("follow the user's language from the start", () => {
    const plugin = require('../../../packages/ui/plugins/vue-i18n.js').default;
    const $vuetify = { lang: { current: 'fr' } };
    const app = { context: { $vuetify } };
    const store = {
      getters: { 'user/LOCALE': 'en', 'page/DEFAULT_LOCALE': 'fr' },
      watch: () => {},
    };

    plugin({ app, store });

    expect($vuetify.lang.current).toBe('en');
  });
});
