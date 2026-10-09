'use strict';

const ko = require('knockout');
const { getSubject, canWriteSubject, setSubject } = require('../email-subject');
const { extractEmailCopy } = require('../text-generation/email-copy');
const {
  readPreheader,
  canWritePreheader,
  writePreheader,
} = require('../email-preheader');

/**
 * What the AI actions read from and write into the email being edited: the
 * `editor` of an action session, and the context of the action registry.
 * Everything is read when asked, not once: the subject is typed in a form, the
 * template decides whether there is a preheader.
 */
function createEditorAccess(viewModel) {
  // A subject the user generated and copied, for an email whose subject lives
  // in the sending platform: the preheader builds on it all the same.
  let rememberedSubject = null;
  const knownSubject = () => getSubject(viewModel) || rememberedSubject || '';

  return {
    get mailingId() {
      return viewModel.metadata.id;
    },
    get canApplySubject() {
      return canWriteSubject(viewModel);
    },
    get canApplyPreheader() {
      return canWritePreheader(viewModel);
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
    knownSubject,
    rememberSubject: (value) => {
      rememberedSubject = value;
    },
    setSubject: (value) => setSubject(viewModel, value),
    // A preheader switched off is no current text: it shows nowhere.
    getPreheader: () =>
      canWritePreheader(viewModel) ? readPreheader(viewModel).value : '',
    setPreheader: (value) => writePreheader(viewModel, value),
    startMultiple: () => viewModel.startMultiple(),
    stopMultiple: () => viewModel.stopMultiple(),
    // The context the action registry decides from.
    context() {
      const textGeneration = Boolean(
        viewModel.metadata.hasTextGenerationFeature
      );
      return {
        textGeneration,
        hasSubject: Boolean(knownSubject().trim()),
        hasSubjectField: canWriteSubject(viewModel),
        // The whole content is read only when an action may need it.
        hasPreheaderField: textGeneration && canWritePreheader(viewModel),
      };
    },
  };
}

module.exports = { createEditorAccess };
