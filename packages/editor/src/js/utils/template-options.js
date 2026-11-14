'use strict';

/**
 * The template options the editor hides (ADR-0024): a root property of the
 * template that a dimension in the email's scope feeds. The dimension decides,
 * and two selects for one property can only disagree.
 *
 * A dimension out of the email's scope is not sent to the editor, so it hides
 * nothing. A deactivated one no longer decides, so its option comes back.
 * Covered by tests/editor/template-options.test.js.
 *
 * @param {Object} params
 * @param {Array} params.dimensions the dimensions the server sent the editor
 * @param {string[]} params.templateProperties the root properties of the template
 * @returns {string[]} the properties whose option is hidden
 */
function hiddenTemplateOptions({ dimensions, templateProperties }) {
  const fed = new Set(
    (dimensions || [])
      .filter((dimension) => dimension.isActive !== false)
      .map((dimension) => dimension.name)
  );
  return (templateProperties || []).filter((property) => fed.has(property));
}

/**
 * The root properties of an email's content: the observables Mosaico built from
 * the template's `template { }` definition and its `_root_` reads.
 *
 * @param {Object|null} content the root of the email's content
 * @returns {string[]}
 */
function rootPropertiesOf(content) {
  if (!content) return [];
  return Object.keys(content).filter(
    (name) => typeof content[name] === 'function'
  );
}

module.exports = { hiddenTemplateOptions, rootPropertiesOf };
