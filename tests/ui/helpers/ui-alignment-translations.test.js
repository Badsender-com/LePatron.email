'use strict';

// The UI alignment work (switches, filters, dialogs, outcome of a save) adds
// words to the two locales. A key that is missing shows on the page as its own
// name ("global.saveOutcome.saved"): this reads the keys the new components
// ask for, and the namespaces they added, in both languages.

const fs = require('fs');
const path = require('path');

const ui = (file) => path.join(__dirname, '../../../packages/ui', file);

const locales = {
  fr: require(ui('helpers/locales/fr.js')).default,
  en: require(ui('helpers/locales/en.js')).default,
};

const get = (object, key) =>
  key.split('.').reduce((node, part) => node && node[part], object);

const leaves = (object, prefix = '') =>
  Object.entries(object).flatMap(([name, value]) =>
    value && typeof value === 'object'
      ? leaves(value, `${prefix}${name}.`)
      : [`${prefix}${name}`]
  );

// Files written or reworked by the alignment, whose keys are all static.
const FILES = [
  'components/layout/bs-save-outcome.vue',
  'components/group/setting-card.vue',
  'components/group/feature-switch.vue',
  'components/group/two-factor-option.vue',
  'components/group/email-builder-tab.vue',
  'components/group/export-options-tab.vue',
  'components/group/tracking-params-tab.vue',
  'components/group/colors-tab.vue',
  'components/template/template-tracking-tab.vue',
  'components/sidebar/bs-upgrade-modal.vue',
  'components/template/form.vue',
  'components/mailings/modal-transfer.vue',
  'routes/mailings/__partials/mailings-filters.vue',
  'routes/mailings/__partials/mailings-date-field.vue',
  'routes/mailings/__partials/mailings-search-scope.vue',
];

const NAMESPACES = [
  'global.saveOutcome',
  'global.states',
  'twoFactor.group',
  'mailings.filters',
  'mailings.search',
  'forms.group.sections',
  'forms.group.saml',
  'emailBuilderSettings.metadata',
];

describe('the words of the UI alignment', () => {
  FILES.forEach((file) => {
    it(`${file} asks only for keys both languages have`, () => {
      const source = fs.readFileSync(ui(file), 'utf8');
      const keys = [
        ...source.matchAll(
          /\$t[c]?\(\s*['"`]([A-Za-z0-9_.]+\.[A-Za-z0-9_.]+)['"`]/g
        ),
      ].map((match) => match[1]);
      const missing = keys.flatMap((key) =>
        ['fr', 'en']
          .filter((language) => !get(locales[language], key))
          .map((language) => `${language}: ${key}`)
      );
      expect(missing).toEqual([]);
    });
  });

  NAMESPACES.forEach((namespace) => {
    it(`${namespace} is the same in French and in English`, () => {
      const fr = leaves(get(locales.fr, namespace)).sort();
      const en = leaves(get(locales.en, namespace)).sort();
      expect(en).toEqual(fr);
    });
  });
});
