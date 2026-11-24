'use strict';

// A row of columns, as email markup.
//
// The row and its cells are layout components (components/row.vue and
// components/column.vue), compiled like every element: what this module does
// is decide which variant each cell takes and what goes in it.

const { resolveElement } = require('./element-markup.js');
const { stackClassFor } = require('./generated-classes.js');
const { usableWidths } = require('./composition.js');
const { defineTemplate } = require('./template.js');
const columnTemplates = require('./components/column.compiled.js');
const rowTemplates = require('./components/row.compiled.js');

const renderRow = defineTemplate(rowTemplates.default);
const COLUMN_VARIANTS = {
  stacked: {
    filled: defineTemplate(columnTemplates.filled),
    empty: defineTemplate(columnTemplates.empty),
  },
  alone: {
    filled: defineTemplate(columnTemplates.filledAlone),
    empty: defineTemplate(columnTemplates.emptyAlone),
  },
};

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
 * The columns of a row, normalised.
 *
 * `generate` is handed `parseState`'s output by the server, but the modal
 * hands it the state it is editing, and nothing types that. So a column that
 * is not an object counts as an empty one — it keeps its cell, the way an
 * empty column does, instead of vanishing and widening its neighbours — and
 * widths go through the same rule `parseState` applies, so a width that is
 * missing or not a number gives equal shares here as it would once stored.
 *
 * @param {Object} row
 * @returns {Array<{width: number, elements: Array<Object>}>}
 */
function columnsOf(row) {
  const stored = row && Array.isArray(row.columns) ? row.columns : [];
  const columns = stored.map((column) =>
    column && typeof column === 'object' ? column : {}
  );
  const widths = usableWidths(
    columns.map((column) =>
      typeof column.width === 'number' ? column.width : Number(column.width)
    )
  );
  return columns.map((column, index) => ({
    width: widths[index],
    elements: column.elements,
  }));
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
  const columns = columnsOf(row);
  if (columns.length === 0) return '';

  const resolved = columns.map((column) =>
    resolveColumn(column.elements, options)
  );

  // A row where every column is empty renders nothing at all: it would
  // otherwise ship a band of blank cells nobody can see or click.
  if (resolved.every((elements) => elements.length === 0)) return '';

  const stackClass = stackClassFor(columns.length);
  const variants = stackClass ? COLUMN_VARIANTS.stacked : COLUMN_VARIANTS.alone;

  const cells = columns.map((column, index) => {
    const elements = resolved[index];
    const values = {
      width: `${column.width}%`,
      stackClass,
      content: renderColumnContent(elements),
    };
    return elements.length === 0
      ? variants.empty(values)
      : variants.filled(values);
  });

  return renderRow({ cells: cells.join('') });
}

module.exports = { generateRow };
