'use strict';

const ko = require('knockout');

// The copy that lives outside the blocks: the subject (email metadata) and the
// preheader (a template property). Both are the client's to write.

/**
 * The subject being edited, or null when the company does not use the email
 * metadata: the editor then knows nothing of the subject (the ESP holds it).
 * @returns {string|null}
 */
function getSubject(viewModel) {
  const store = viewModel.emailMetadataStore;
  if (!store || !store.isActive || !store.isActive()) return null;
  const { subject } = store.snapshot();
  return typeof subject === 'string' ? subject : '';
}

// Templates declare their preheader either at the root (`preheaderText`) or in
// a root-level `preheaderBlock` (docs/TEMPLATE_DEVELOPER_GUIDE.md, preheader).
const PREHEADER_PATHS = [['preheaderText'], ['preheaderBlock', 'preheaderText']];

const get = (object, path) =>
  path.reduce((value, key) => (value == null ? undefined : value[key]), object);

/**
 * The preheader of the email, or null when the template has none.
 * @returns {{ value: string, templateDefault: string, turnedOff: boolean }|null}
 */
function getPreheader(viewModel) {
  const content = ko.toJS(viewModel.content()) || {};
  const path = PREHEADER_PATHS.find(
    (candidate) => typeof get(content, candidate) === 'string'
  );
  if (!path) return null;
  const defaults = viewModel.templateDefaults || {};
  return {
    value: get(content, path),
    templateDefault: get(defaults, path) || '',
    // versafix-like templates can switch the preheader off entirely.
    turnedOff: content.preheaderVisible === false,
  };
}

module.exports = { getSubject, getPreheader, PREHEADER_PATHS };
