'use strict';

const { orUndefined } = require('./text');

/**
 * Generate the preheader of the email (text generation, ADR 0003). Built on
 * the subject; without one, the panel urges to write the subject first and
 * still lets the user go on (ADR 0004). A template property: one step of the
 * editor's own undo.
 */
module.exports = {
  id: 'generate-preheader',
  family: 'proposals',
  feature: 'textGeneration',
  targets: ['email', 'preheader'],
  describe: (context) => ({
    // Without a preheader in the template the proposals are offered to copy.
    canApply: Boolean(context.hasPreheaderField),
    ...(!context.hasSubject && { suggestFirst: 'generate-subject' }),
  }),

  route: 'preheader',
  field: 'preheader',
  request: (editor) => ({
    // The subject on screen, or the one the user copied for their platform.
    subject: orUndefined(editor.knownSubject()),
    currentPreheader: orUndefined(editor.getPreheader()),
  }),
  canWrite: (editor) => editor.canApplyPreheader,
  read: (editor) => editor.getPreheader() || '',
  write: (editor, target, value) => {
    editor.startMultiple();
    try {
      editor.setPreheader(value);
    } finally {
      editor.stopMultiple();
    }
  },
  next: null,

  labels: {
    name: 'ai-panel-action-preheader',
    generate: 'ai-panel-generate-preheader',
    proposals: 'text-generation-preheaders-title',
    copyHint: 'text-generation-copy-hint-preheader',
    applied: 'text-generation-applied-preheader',
    // Offered after the subject, as the next step.
    continueWith: 'ai-panel-next-preheader',
    // Urged to write the subject first.
    firstNotice: 'ai-panel-no-subject',
    firstAnyway: 'ai-panel-preheader-anyway',
  },
};
