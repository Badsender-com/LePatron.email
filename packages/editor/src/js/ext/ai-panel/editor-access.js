'use strict';

const ko = require('knockout');
const { getSubject, canWriteSubject, setSubject } = require('../email-subject');
const { extractEmailCopy } = require('../text-generation/email-copy');
const {
  findPreheader,
  writePreheader,
} = require('../text-generation/template-preheader');

/**
 * What the AI actions read from and write into the email being edited: the
 * `editor` of an action session, and the context of the action registry.
 * Everything is read when asked, not once: the subject is typed in a form, the
 * template decides whether there is a preheader.
 */
function createEditorAccess(viewModel) {
  const content = () => ko.toJS(viewModel.content());
  const preheader = () => findPreheader(content());

  return {
    get mailingId() {
      return viewModel.metadata.id;
    },
    get canApplySubject() {
      return canWriteSubject(viewModel);
    },
    get canApplyPreheader() {
      return Boolean(preheader());
    },
    // The text on screen, the sample values of the template left out.
    emailCopy() {
      const defs = ko.toJS(viewModel.blockDefs) || [];
      const sampleFor = (blockType, field) => {
        const def = defs.find((d) => d.type === blockType);
        return def && typeof def[field] === 'string' ? def[field] : undefined;
      };
      const canvas = document.getElementById('main-wysiwyg-area') || document;
      return extractEmailCopy(canvas, { sampleFor });
    },
    getSubject: () => getSubject(viewModel) || '',
    setSubject: (value) => setSubject(viewModel, value),
    getPreheader: () => (preheader() || { value: '' }).value,
    setPreheader: (value) => writePreheader(viewModel.content, value),
    startMultiple: () => viewModel.startMultiple(),
    stopMultiple: () => viewModel.stopMultiple(),
    // The context the action registry decides from.
    context() {
      return {
        textGeneration: Boolean(viewModel.metadata.hasTextGenerationFeature),
        hasSubject: Boolean((getSubject(viewModel) || '').trim()),
        hasSubjectField: canWriteSubject(viewModel),
        hasPreheaderField: Boolean(preheader()),
      };
    },
  };
}

module.exports = { createEditorAccess };
