'use strict';

// Every string the builder shows goes through the editor's dictionaries. The
// panel and the list hold i18n keys, not French; a key with no entry would
// show up as the key itself.

const {
  LABEL_KEYS,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/element-settings.js');
const {
  PALETTE,
  SEED_KEYS,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/element-list.js');
const MODAL_TEMPLATE = require('../../../packages/editor/src/js/vue/components/block-builder-modal/modal-template.js');
const fr = require('../../../public/lang/badsender-fr.js');
const en = require('../../../public/lang/badsender-en.js');

// The keys the modal's template asks `vm.t` for, read off the template itself so
// a key added there is checked without being listed here.
const templateKeys = Array.from(
  MODAL_TEMPLATE.matchAll(/vm\.t\('([^']+)'\)/g),
  (match) => match[1]
);

// Strings written into the preview iframe or into a new element, rather than
// through the template.
const scriptKeys = Object.values(SEED_KEYS)
  .map((seed) => seed.label)
  .concat(['block-builder-drop-here']);

const keys = Array.from(
  new Set(
    LABEL_KEYS.concat(PALETTE.map((entry) => entry.labelKey))
      .concat(templateKeys)
      .concat(scriptKeys)
  )
);

describe('block builder strings', () => {
  it('reads keys off the template', () => {
    expect(templateKeys).toContain('block-builder-preview-title');
  });

  it.each(keys)('%s is translated in French and English', (key) => {
    expect(fr[key]).toEqual(expect.any(String));
    expect(en[key]).toEqual(expect.any(String));
  });
});
