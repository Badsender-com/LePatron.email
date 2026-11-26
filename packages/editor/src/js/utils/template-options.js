'use strict';

const { isPublishable } = require('./publish-to-template');

/**
 * The template options the editor hides: the root property of the template a
 * company dimension sent to the editor feeds (ADR-0015). The dimension decides,
 * and two selects for one property can only disagree: the dimension would
 * overwrite the template option's choice at its next change.
 *
 * A deactivated dimension is not sent to the editor, or is sent flagged, and
 * no longer decides: its option comes back. Covered by
 * tests/editor/template-options.test.js.
 *
 * @param {Object} params
 * @param {Array} params.dimensions the company dimensions the server sent the
 *   editor
 * @param {string[]} params.templateProperties the root properties of the template
 * @returns {string[]} the properties whose option is hidden
 */
function hiddenTemplateOptions({ dimensions, templateProperties }) {
  const fed = (dimensions || [])
    .filter((dimension) => dimension.isActive !== false)
    .map((dimension) => dimension.name);
  return (templateProperties || []).filter((property) =>
    fed.includes(property)
  );
}

/**
 * The root properties of an email's content a dimension can feed: the
 * observables holding a plain value that Mosaico built from the template's
 * options and its `_root_` reads, those utils/publish-to-template.js writes.
 *
 * @param {Object|null} content the root of the email's content
 * @returns {string[]}
 */
function rootPropertiesOf(content) {
  if (!content) return [];
  return Object.keys(content).filter((name) => isPublishable(content[name]));
}

module.exports = { hiddenTemplateOptions, rootPropertiesOf };
