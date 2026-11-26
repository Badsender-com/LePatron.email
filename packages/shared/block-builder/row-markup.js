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
const {
  BLOCK_WIDTH,
  rowLayout,
  percentOfBlock,
  isWholePercent,
} = require('./row-layout.js');
const { rowStackSpacing } = require('./row-spacing.js');
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
 * The columns of a row, normalised, each with the gutter before it.
 *
 * `generate` is handed `parseState`'s output by the server, but the modal
 * hands it the state it is editing, and nothing types that. So a column that
 * is not an object counts as an empty one — it keeps its cell, the way an
 * empty column does, instead of vanishing and widening its neighbours — and
 * the layout goes through the same rule `parseState` applies (rowLayout), so
 * a width that is missing or not a number gives equal shares here as it would
 * once stored.
 *
 * @param {Object} row
 * @returns {Array<{width: number, gutter: number, elements: Array<Object>}>}
 */
function columnsOf(row) {
  const stored = row && Array.isArray(row.columns) ? row.columns : [];
  const columns = stored.map((column) =>
    column && typeof column === 'object' ? column : {}
  );
  const { widths, gutters } = rowLayout(
    columns.map((column) =>
      typeof column.width === 'number' ? column.width : Number(column.width)
    ),
    row && row.gutters
  );
  return columns.map((column, index) => ({
    width: widths[index],
    gutter: index === 0 ? 0 : gutters[index - 1],
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
 * The classes each cell of a row carries, in column order: an empty list for a
 * cell that carries none.
 *
 * Every cell of a row of several columns stacks, and a cell with a gutter
 * before it drops it on a phone. The stack spacing goes under a column that
 * holds something and has another one holding something after it, and only
 * there: an empty column takes no room once stacked, and must not leave a
 * blank band, nor double the space between the two it sits between. A row of
 * one column has nothing to stack, and a row holding nothing renders nothing
 * (see generateRow): neither carries a class, nor may ask the stylesheet for a
 * rule.
 *
 * @param {Object} row as stored or edited
 * @param {Array<{gutter: number, elements: *}>} columns what columnsOf returned
 * @returns {Array<Array<string>>}
 */
function classesOfCells(row, columns) {
  const filled = columns.map((column) => !isEmptyColumn(column));
  const stack = filled.some(Boolean) ? stackClassFor(columns.length) : '';
  if (stack === '') return columns.map(() => []);

  const spacing = stackSpacingClassFor(rowStackSpacing(row, columns.length));
  return columns.map((column, index) =>
    [
      stack,
      gutterClassFor(column.gutter),
      filled[index] && filled.slice(index + 1).some(Boolean) ? spacing : '',
    ].filter(Boolean)
  );
}

/**
 * The classes a row's cells carry, one list per cell.
 *
 * The one place that decides it. The markup (generateRow) and the stylesheet
 * (stylesheet.js) both ask here, so the stylesheet never holds a rule for a
 * class no cell carries, nor the reverse. A list per cell rather than one for
 * the row: the stack spacing and the gutter are not on every cell.
 *
 * @param {Object} row one entry of a composition's `rows`, as stored
 * @returns {Array<Array<string>>}
 */
function rowClasses(row) {
  return classesOfCells(row, columnsOf(row));
}

/**
 * One row, as a table of cells.
 *
 * Cells rather than `inline-block` divs: that is what lets Outlook lay the
 * columns out natively, with no ghost table. A column holding nothing keeps
 * its cell — two half columns become one full-width column the moment one of
 * them disappears — so emptiness picks a variant, it never drops the cell.
 *
 * A cell is its column's width plus the gutter before it, which is its
 * padding: so what the cell holds is exactly the column's width, and an image
 * in it is told that width. Its `width` attribute, which Outlook reads, is a
 * percentage when every cell of the row is a whole one, and px otherwise (see
 * components/column.vue).
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

  const classes = classesOfCells(row, columns);
  const rowId = chrome ? escapeForContext(row.id, ATTR) : '';
  const inPercent = columns.every((column) =>
    isWholePercent(column.width + column.gutter)
  );

  const cells = columns.map((column, index) => {
    const elements = resolveColumn(column.elements, options, column.width);
    const content = renderColumnContent(elements);
    const pixels = column.width + column.gutter;
    const values = {
      width: percentOfBlock(pixels),
      widthAttribute: inPercent ? percentOfBlock(pixels) : pixels,
      gutter: column.gutter,
      classes: classes[index].join(' '),
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
    const variants = variantsOf(classes[index], column.gutter);
    return elements.length === 0 && !chrome
      ? variants.empty(values)
      : variants.filled(values);
  });

  return renderRow({ cells: cells.join('') });
}

/**
 * The variants a cell takes: a cell that carries no class (a row of one
 * column, or a row holding nothing, shown in the preview) takes the ones
 * without a class attribute, and a stacking cell with a gutter before it the
 * padded ones. Gutters only exist between columns, so only a stacking cell is
 * ever padded.
 *
 * @param {Array<string>} classes the cell's
 * @param {number} gutter the gutter before it
 * @returns {{filled: Function, empty: Function}}
 */
function variantsOf(classes, gutter) {
  if (classes.length === 0) return COLUMN_VARIANTS.alone;
  return gutter > 0 ? COLUMN_VARIANTS.padded : COLUMN_VARIANTS.stacked;
}

module.exports = {
  generateRow,
  rowClasses,
  BLOCK_WIDTH,
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
  COLUMN_CHROME_CLASS,
};
