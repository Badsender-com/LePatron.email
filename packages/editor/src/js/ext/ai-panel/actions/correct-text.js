'use strict';

/**
 * Correct the spelling, grammar and typography of a text (ADR 0011), an
 * action of text generation. Its steps are those of the "corrections" family:
 * analyse, then accept or ignore each correction; an accepted one is written
 * into the email and undone with the editor's own Ctrl+Z.
 */
module.exports = {
  id: 'correct-text',
  family: 'corrections',
  feature: 'textGeneration',
  skill: 'redaction.correction',
  targets: ['blockField', 'block', 'email'],
  // A block without text has nothing to correct: a separator, an image
  // without its alternative text. The block toolbar and the panel both ask.
  offeredOn: (target, context) =>
    target.kind !== 'block' ||
    Boolean(context.blockHasText && context.blockHasText(target.blockId)),
  // A correction is always written: block fields are the email's own.
  describe: () => ({ canApply: true }),

  route: 'corrections',

  labels: {
    name: 'ai-panel-action-correct',
    // What an entry point that opens it directly says.
    entry: 'ai-field-correct-label',
  },
};
