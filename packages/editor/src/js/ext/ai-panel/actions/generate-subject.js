'use strict';

const { orUndefined } = require('./text');

/**
 * Generate the subject of the email (text generation, ADR 0003). Offered on
 * the whole email and on the subject field; written through the metadata
 * store, outside the editor's undo, so the panel keeps its own undo.
 */
module.exports = {
  id: 'generate-subject',
  family: 'proposals',
  feature: 'textGeneration',
  targets: ['email', 'subject'],
  // Without a subject field the proposals are offered to copy.
  describe: (context) => ({ canApply: Boolean(context.hasSubjectField) }),

  route: 'subject',
  field: 'subject',
  request: (editor) => ({ currentSubject: orUndefined(editor.getSubject()) }),
  canWrite: (editor) => editor.canApplySubject,
  read: (editor) => editor.getSubject() || '',
  write: (editor, target, value) => editor.setSubject(value),
  // A copied subject is the one the preheader then builds on, as if applied.
  onCopied: (editor, text) => editor.rememberSubject(text),
  next: 'generate-preheader',

  labels: {
    name: 'ai-panel-action-subject',
    generate: 'ai-panel-generate-subject',
    proposals: 'text-generation-subjects-title',
    copyHint: 'text-generation-copy-hint',
    applied: 'text-generation-applied-subject',
    // When another action suggests this one first.
    first: 'ai-panel-subject-first',
  },
};
