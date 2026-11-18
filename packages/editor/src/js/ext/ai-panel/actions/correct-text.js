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
  targets: ['blockField', 'block', 'email'],
  // A correction is always written: block fields are the email's own.
  describe: () => ({ canApply: true }),

  route: 'corrections',

  // In the panel's list (board a2): each action says what it is on.
  icon: 'lucide-spell-check',
  labels: {
    name: 'ai-panel-action-correct',
    byKind: {
      blockField: 'ai-panel-correct-field',
      block: 'ai-panel-correct-block',
      email: 'ai-panel-correct-email',
    },
    describeByKind: {
      blockField: 'ai-panel-correct-field-desc',
      block: 'ai-panel-correct-block-desc',
      email: 'ai-panel-correct-email-desc',
    },
    // « Les 4 champs de texte du bloc », when the panel can count them.
    describeCountByKind: {
      block: 'ai-panel-correct-block-desc-count',
    },
  },
};
