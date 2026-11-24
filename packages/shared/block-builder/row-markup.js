'use strict';

// A row of columns, as email markup.
//
// The row and its cells are layout components (components/row.vue and
// components/column.vue), compiled like every element: what this module does
// is decide which variant each cell takes and what goes in it.

const { resolveElement } = require('./element-markup.js');
const { stackClassFor } = require('./generated-classes.js');
const { defineTemplate } = require('./template.js');
const columnTemplates = require('./components/column.compiled.js');
const rowTemplates = require('./components/row.compiled.js');

const renderRow = defineTemplate(rowTemplates.default);
const renderFilledColumn = defineTemplate(columnTemplates.filled);
const renderEmptyColumn = defineTemplate(columnTemplates.empty);

/**
 * The elements of a column, resolved once each. A column is empty exactly when
 * this comes back empty: the same rule as for a flat block's rows (see
 * resolveElement), so the preview and the export never disagree on it.
 *
 * @param {Array<Object>} elements
 * @param {Object} [options] see generate
 * @returns {Array<{markup: string, attributes: string}>}
 */
function resolveColumn(elements, options) {
  return (Array.isArray(elements) ? elements : [])
    .map((element) => resolveElement(element, options))
    .filter(Boolean);
}

/**
 * The elements of a column, stacked.
 *
 * Each element already renders a complete table of its own, so concatenating
 * them stacks them — no wrapper needed, and none added: a `<div>` nobody asked
 * for would change the markup of every email. The one exception is the editing
 * chrome, which needs somewhere to live and is empty unless the preview asks,
 * so it brings its own wrapper and only then.
 *
 * @param {Array<Object>} resolved what resolveColumn returned
 * @returns {string}
 */
function renderColumnContent(resolved) {
  return resolved
    .map(({ markup, attributes }) =>
      attributes ? `<div${attributes}>${markup}</div>` : markup
    )
    .join('');
}

/**
 * One row, as a table of real percentage cells.
 *
 * Cells rather than `inline-block` divs: that is what lets Outlook lay the
 * columns out natively, with no ghost table. A column holding nothing keeps
 * its cell — two 50% columns become one full-width column the moment one of
 * them disappears — so emptiness picks a variant, it never drops the cell.
 *
 * @param {Object} row
 * @param {Object} [options] see generate
 * @returns {string} the row's markup, or '' when it holds nothing anywhere
 */
function generateRow(row, options) {
  const columns = (row && Array.isArray(row.columns) ? row.columns : []).filter(
    (column) => column && typeof column === 'object'
  );
  if (columns.length === 0) return '';

  const resolved = columns.map((column) =>
    resolveColumn(column.elements, options)
  );

  // A row where every column is empty renders nothing at all: it would
  // otherwise ship a band of blank cells nobody can see or click.
  if (resolved.every((elements) => elements.length === 0)) return '';

  const stackClass = stackClassFor(columns.length);

  const cells = columns.map((column, index) => {
    const elements = resolved[index];
    const values = {
      width: `${column.width}%`,
      stackClass,
      content: renderColumnContent(elements),
    };
    return elements.length === 0
      ? renderEmptyColumn(values)
      : renderFilledColumn(values);
  });

  return renderRow({ cells: cells.join('') });
}

module.exports = { generateRow };
