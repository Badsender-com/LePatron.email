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
 * Whether the subject field is on screen to write into: the metadata section
 * hangs its setter on the view model while it is mounted.
 * @returns {boolean}
 */
function canWriteSubject(viewModel) {
  return typeof viewModel.setEmailSubject === 'function';
}

/**
 * Write into the subject field, as if the user had typed it: the metadata
 * section saves it with the email.
 * @returns {boolean} false when there is no subject field
 */
function setSubject(viewModel, value) {
  if (!canWriteSubject(viewModel)) return false;
  viewModel.setEmailSubject(value);
  return true;
}

module.exports = { getSubject, canWriteSubject, setSubject };
