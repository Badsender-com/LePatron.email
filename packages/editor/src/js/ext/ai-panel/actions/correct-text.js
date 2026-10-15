'use strict';

/**
 * Correct the spelling, grammar and typography of a text (ADR 0005), an
 * action of text generation. Its steps are those of the "corrections" family:
 * analyse, then accept or ignore each correction; an accepted one is written
 * into the email and undone with the editor's own Ctrl+Z.
 */
module.exports = {
  id: 'correct-text',
  family: 'corrections',
  feature: 'textGeneration',
  targets: ['blockField', 'block', 'email'],
  // A correction is always written: block fields are the email's own.
  describe: () => ({ canApply: true }),

  route: 'corrections',

  labels: {
    name: 'ai-panel-action-correct',
  },
};
