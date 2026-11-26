'use strict';

// The trigger's two values carry one wording, defined once in
// packages/shared/taxonomy/trigger-definitions.js: the admin who reads the
// definition on the taxonomy screen, the user who picks the value in the
// editor and the AI handed the governance context must read the same words.

const {
  EMAIL_TRIGGER_DEFINITIONS,
} = require('../../../packages/shared/taxonomy/trigger-definitions.js');
const {
  EMAIL_TRIGGER_VALUES,
} = require('../../../packages/shared/taxonomy/constants.js');
const fr = require('../../../packages/ui/helpers/locales/fr').default;
const en = require('../../../packages/ui/helpers/locales/en').default;
const editorFr = require('../../../public/lang/badsender-fr.js');
const editorEn = require('../../../public/lang/badsender-en.js');
const {
  EmailTriggerDefinitions,
} = require('../../../packages/server/constant/email-trigger.js');

describe('the wording of the trigger values', () => {
  it('defines exactly the trigger values, in both languages', () => {
    expect(Object.keys(EMAIL_TRIGGER_DEFINITIONS).sort()).toEqual(['en', 'fr']);
    Object.values(EMAIL_TRIGGER_DEFINITIONS).forEach((definitions) => {
      expect(Object.keys(definitions).sort()).toEqual(
        [...EMAIL_TRIGGER_VALUES].sort()
      );
    });
  });

  it('is what the server hands to the AI', () => {
    expect(EmailTriggerDefinitions).toBe(EMAIL_TRIGGER_DEFINITIONS);
  });

  describe.each([
    ['fr', fr, editorFr],
    ['en', en, editorEn],
  ])('in %s', (lang, screen, editor) => {
    describe.each(EMAIL_TRIGGER_VALUES)('for %s', (value) => {
      const shared = EMAIL_TRIGGER_DEFINITIONS[lang][value];

      it('is the label and the definition of the taxonomy screen', () => {
        expect(screen.taxonomy.dimensions.trigger[value]).toEqual({
          label: shared.label,
          description: shared.description,
        });
      });

      it('is the label and the definition of the editor', () => {
        expect(editor[`email-metadata-trigger-${value}`]).toBe(shared.label);
        expect(editor[`email-metadata-trigger-${value}-description`]).toBe(
          shared.description
        );
      });
    });
  });
});
