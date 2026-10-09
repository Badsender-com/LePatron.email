'use strict';

/**
 * The subject of the email: the one accessor that quality control and the AI
 * actions read and write it through (ADR 0004).
 *
 * The subject lives in the email metadata. A company that does not use them
 * leaves the subject to its sending platform, and the editor knows nothing of
 * it: reading gives null, and nothing can be written.
 */

/**
 * The subject being edited, or null when the company does not use the email
 * metadata.
 * @returns {string|null}
 */
function getSubject(viewModel) {
  const store = viewModel.emailMetadataStore;
  if (!store || !store.isActive || !store.isActive()) return null;
  const { subject } = store.snapshot();
  return typeof subject === 'string' ? subject : '';
}

/**
 * Whether there is a subject field to write into: the metadata section is
 * mounted.
 * @returns {boolean}
 */
function canWriteSubject(viewModel) {
  const store = viewModel.emailMetadataStore;
  return Boolean(store && store.isActive && store.isActive());
}

/**
 * Write the subject as if the user had typed it, through the metadata store:
 * read back at once, saved with the email, shown by the section.
 * @returns {boolean} false when there is no subject field
 */
function setSubject(viewModel, value) {
  if (!canWriteSubject(viewModel)) return false;
  return viewModel.emailMetadataStore.writeField('subject', value);
}

module.exports = { getSubject, canWriteSubject, setSubject };
