'use strict';

// A row of columns, as email markup.
//
// The row and its cells are layout components (components/row.vue and
// components/column.vue), compiled like every element: what this module does
// is decide which variant each cell takes and what goes in it.

const { resolveElement, definitionOf } = require('./element-markup.js');
const { escapeForContext, ATTR } = require('./slot-contexts.js');
const { stackClassFor } = require('./generated-classes.js');
const { usableWidths } = require('./composition.js');
const { defineLayout } = require('./template.js');
const columnTemplates = require('./components/column.compiled.js');
const rowTemplates = require('./components/row.compiled.js');

const renderRow = defineLayout(rowTemplates.default);
const COLUMN_VARIANTS = {
  stacked: {
    filled: defineLayout(columnTemplates.filled),
    empty: defineLayout(columnTemplates.empty),
  },
  alone: {
    filled: defineLayout(columnTemplates.filledAlone),
    empty: defineLayout(columnTemplates.emptyAlone),
  },
};

// The width a block is laid out for, in px. Email templates are built for
// 600px, and the column limits in composition.js assume it too.
//
// A percentage is all a cell needs, but not all its content: Outlook on
// Windows ignores `max-width` and lays an image out at its `width` attribute,
// so an image in a half-width column has to be told it has 300px, not 600.
const BLOCK_WIDTH = 600;

// Editing chrome on a column: which row and which column a cell is, so a drag
// can tell where the cursor is without the preview having to guess from
// coordinates alone. Written only when the preview asks, like the element's
// own chrome (element-markup.js) — an email has no use for either.
const COLUMN_ROW_ATTRIBUTE = 'data-lp-row';
const COLUMN_INDEX_ATTRIBUTE = 'data-lp-col';
// The class the preview styles to make a column visible as a drop target, and
// to give an empty one a box worth aiming at.
const COLUMN_CHROME_CLASS = 'lp-bb-col';

/**
 * The elements of a column, resolved once each. A column is empty exactly when
 * this comes back empty: the same rule as for a flat block's rows (see
 * resolveElement), so the preview and the export never disagree on it.
 *
 * @param {Array<Object>} elements
 * @param {Object} [options] see generate
 * @param {number} containerWidth the column's room, in px
 * @returns {Array<{markup: string, attributes: string}>}
 */
function resolveColumn(elements, options, containerWidth) {
  return (Array.isArray(elements) ? elements : [])
    .map((element) => resolveElement(element, options, containerWidth))
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
 * Whether a column holds nothing to render. The same rule resolveColumn
 * applies (an element is nothing exactly when definitionOf says so), asked
 * without rendering anything.
 *
 * @param {{elements: *}} column one entry of columnsOf
 * @returns {boolean}
 */
function isEmptyColumn(column) {
  return !(
    Array.isArray(column.elements) &&
    column.elements.some((element) => definitionOf(element) !== null)
  );
}

/**
 * The class the cells of these columns carry, or '' for none.
 *
 * @param {Array<{elements: *}>} columns what columnsOf returned
 * @returns {string}
 */
function classOfColumns(columns) {
  // A row with nothing in any column renders nothing (see generateRow), so it
  // carries no class either — and must not ask the stylesheet for a rule.
  if (columns.every(isEmptyColumn)) return '';
  return stackClassFor(columns.length);
}

/**
 * The class a row's cells carry, or '' when they carry none: a row of one
 * column has nothing to stack, and a row holding nothing renders nothing.
 *
 * The one place that decides it. The markup (generateRow) and the stylesheet
 * (stylesheet.js) both ask here, so the stylesheet never holds a rule for a
 * class no cell carries, nor the reverse.
 *
 * @param {Object} row one entry of a composition's `rows`, as stored
 * @returns {string}
 */
function rowClass(row) {
  return classOfColumns(columnsOf(row));
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

  // The preview's own markup (see `chrome` in generate): each column wrapped
  // in a box that names it, and the rows that hold nothing rendered too.
  const chrome = Boolean(options && options.chrome);

  // A row where every column is empty renders nothing at all: it would
  // otherwise ship a band of blank cells nobody can see or click. A row of no
  // column at all is one of them. With chrome on it stays, as empty columns:
  // an empty row is somewhere a user can still drop.
  if (!chrome && columns.every(isEmptyColumn)) return '';

  const resolved = columns.map((column) =>
    resolveColumn(
      column.elements,
      options,
      Math.floor((BLOCK_WIDTH * column.width) / 100)
    )
  );

  const stackClass = classOfColumns(columns);
  const variants = stackClass ? COLUMN_VARIANTS.stacked : COLUMN_VARIANTS.alone;
  const rowId = chrome ? escapeForContext(row.id, ATTR) : '';

  const cells = columns.map((column, index) => {
    const elements = resolved[index];
    const content = renderColumnContent(elements);
    const values = {
      width: `${column.width}%`,
      stackClass,
      // A box the cursor can be inside, even when the column holds nothing —
      // which is the whole point for an empty one. A div inside the cell
      // rather than attributes on the cell itself: the cell is email markup,
      // written in a component, and chrome has no business in it.
      content: chrome
        ? `<div class="${COLUMN_CHROME_CLASS}"` +
          ` ${COLUMN_ROW_ATTRIBUTE}="${rowId}"` +
          ` ${COLUMN_INDEX_ATTRIBUTE}="${index}">` +
          content +
          '</div>'
        : content,
    };
    // An empty column takes the empty variant, which holds its cell open with
    // a zero-sized space — no room for the chrome's box. With chrome on, it
    // takes the filled one, so the box is there to drop into. Emptiness is
    // read from the elements, never from the rendered string, which the box
    // makes non-empty.
    return elements.length === 0 && !chrome
      ? variants.empty(values)
      : variants.filled(values);
  });

  return renderRow({ cells: cells.join('') });
}

module.exports = {
  generateRow,
  rowClass,
  BLOCK_WIDTH,
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
  COLUMN_CHROME_CLASS,
};
