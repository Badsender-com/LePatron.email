'use strict';

const ko = require('knockout');
const { getSubject } = require('../email-subject');

// The copy that lives outside the blocks: the subject (email metadata, read
// through ext/email-subject.js) and the preheader (a template property). Both
// are the client's to write.

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
