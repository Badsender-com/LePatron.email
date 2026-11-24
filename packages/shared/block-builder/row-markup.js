'use strict';

// A row of columns, as email markup.
//
// The row and its cells are layout components (components/row.vue and
// components/column.vue), compiled like every element: what this module does
// is decide which variant each cell takes and what goes in it.

const { resolveElement, definitionOf } = require('./element-markup.js');
const { escapeForContext, ATTR } = require('./slot-contexts.js');
const {
  stackClassFor,
  gutterClassFor,
  stackSpacingClassFor,
} = require('./generated-classes.js');
const { usableWidths } = require('./composition.js');
const { rowSpacing, gutterSides } = require('./row-spacing.js');
const { defineLayout } = require('./template.js');
const columnTemplates = require('./components/column.compiled.js');
const rowTemplates = require('./components/row.compiled.js');

const renderRow = defineLayout(rowTemplates.default);
const COLUMN_VARIANTS = {
  stacked: {
    filled: defineLayout(columnTemplates.filled),
    empty: defineLayout(columnTemplates.empty),
  },
  padded: {
    filled: defineLayout(columnTemplates.filledPadded),
    empty: defineLayout(columnTemplates.emptyPadded),
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
 * The classes each cell of a row carries, in column order, '' for none.
 *
 * Every cell of a row of several columns stacks; with a gutter, every one drops
 * it on a phone; with a stack spacing, every one but the last keeps that space
 * under it. A row of one column has nothing to stack, and a row holding nothing
 * renders nothing (see generateRow): neither carries a class, nor may ask the
 * stylesheet for a rule.
 *
 * @param {Object} row as stored or edited
 * @param {Array<{elements: *}>} columns what columnsOf returned for it
 * @returns {Array<string>}
 */
function classesOfCells(row, columns) {
  const stack = columns.every(isEmptyColumn)
    ? ''
    : stackClassFor(columns.length);
  if (stack === '') return columns.map(() => '');

  const { gutter, stackSpacing } = rowSpacing(row, columns.length);
  const shared = [stack, gutterClassFor(gutter)];
  const spaced = stackSpacingClassFor(stackSpacing);
  return columns.map((_, index) =>
    shared
      .concat(index < columns.length - 1 ? spaced : '')
      .filter(Boolean)
      .join(' ')
  );
}

/**
 * The classes a row's cells carry, one string per cell, '' for a cell that
 * carries none.
 *
 * The one place that decides it. The markup (generateRow) and the stylesheet
 * (stylesheet.js) both ask here, so the stylesheet never holds a rule for a
 * class no cell carries, nor the reverse. One string per cell rather than one
 * for the row: the last cell of a row with a stack spacing has no space under
 * it.
 *
 * @param {Object} row one entry of a composition's `rows`, as stored
 * @returns {Array<string>}
 */
function rowClasses(row) {
  return classesOfCells(row, columnsOf(row));
}

/**
 * The elements of each column, resolved for the room the column leaves them:
 * its share of the block, minus its half of the gutter on each side that faces
 * another column. An image is told that room, or Outlook would lay it out wider
 * than the cell.
 *
 * @param {Array<{width: number, elements: *}>} columns what columnsOf returned
 * @param {Array<{left: number, right: number}>} sides each cell's padding
 * @param {Object} [options] see generate
 * @returns {Array<Array<{markup: string, attributes: string}>>}
 */
function resolveColumns(columns, sides, options) {
  return columns.map((column, index) =>
    resolveColumn(
      column.elements,
      options,
      Math.floor((BLOCK_WIDTH * column.width) / 100) -
        sides[index].left -
        sides[index].right
    )
  );
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

  const { gutter } = rowSpacing(row, columns.length);
  const sides = columns.map((_, index) =>
    gutterSides(index, columns.length, gutter)
  );
  const resolved = resolveColumns(columns, sides, options);

  const classes = classesOfCells(row, columns);
  // A gutter only exists on a row of several columns (rowSpacing), so the
  // padded variants are stacking ones; a row that carries no class (one
  // column, or nothing in any, shown in the preview) takes neither.
  let variants = COLUMN_VARIANTS.alone;
  if (classes[0]) {
    variants = gutter > 0 ? COLUMN_VARIANTS.padded : COLUMN_VARIANTS.stacked;
  }
  const rowId = chrome ? escapeForContext(row.id, ATTR) : '';

  const cells = columns.map((column, index) => {
    const elements = resolved[index];
    const content = renderColumnContent(elements);
    const values = {
      width: `${column.width}%`,
      classes: classes[index],
      gutterLeft: sides[index].left,
      gutterRight: sides[index].right,
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
  rowClasses,
  BLOCK_WIDTH,
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
  COLUMN_CHROME_CLASS,
};
