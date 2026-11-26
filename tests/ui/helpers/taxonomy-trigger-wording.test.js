'use strict';

// The trigger's two values carry one wording, on the taxonomy screen and in the
// editor: the admin who reads the definition and the user who picks the value
// must recognise the same words.

const fr = require('../../../packages/ui/helpers/locales/fr').default;
const en = require('../../../packages/ui/helpers/locales/en').default;
const editorFr = require('../../../public/lang/badsender-fr.js');
const editorEn = require('../../../public/lang/badsender-en.js');
const {
  EMAIL_TRIGGER_VALUES,
} = require('../../../packages/shared/taxonomy/constants.js');

describe('the wording of the trigger values', () => {
  describe.each([
    ['fr', fr, editorFr],
    ['en', en, editorEn],
  ])('in %s', (lang, screen, editor) => {
    it.each(EMAIL_TRIGGER_VALUES)(
      'labels %s on the taxonomy screen as the editor does',
      (value) => {
        expect(screen.taxonomy.dimensions.trigger[value].label).toBe(
          editor[`email-metadata-trigger-${value}`]
        );
      }
    );
  });
});
