'use strict';

// Composed blocks for the translation tests, stored the way the editor stores
// them: the state serialised, and the markup generated from it on apply
// (block-builder-modal.js handleApply).

const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  elementFor,
} = require('../../../packages/shared/block-builder/elements/index.js');
const {
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');

/** A composed block holding `elements`. */
function composedBlock(elements) {
  const state = { ...emptyState(), rows: singleColumnRows(elements) };
  return {
    type: 'blockBuilderBlock',
    builderState: serialiseState(state),
    builderHtml: generate(state),
  };
}

// An element as the editor creates it from its defaults (element-list.js),
// then edited.
const element = (id, type, values) => ({
  id,
  type,
  ...elementFor(type).defaults,
  ...values,
});

// Bare elements, for the tests that only care about one field.
const text = (content, overrides) => ({
  id: 'e1',
  type: 'text',
  content,
  ...overrides,
});
const button = (label) => ({ id: 'e2', type: 'button', label, href: '#' });
const image = (alt) => ({ id: 'e3', type: 'image', alt, src: '', href: '' });

/**
 * Whole-number widths that make 100, the remainder on the last column: what
 * the structure panel offers (row-settings.js). A fraction would be normalised
 * on read, so the test would not hold what it wrote.
 *
 * @param {number} count
 * @returns {Array<number>}
 */
function evenWidths(count) {
  const width = Math.floor(100 / count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? 100 - width * (count - 1) : width
  );
}

/**
 * A composed block stored in rows of columns. One that is more than a single
 * full-width column is stored as `{ v: 2, rows }` and renders its rows.
 *
 * Row ids follow ROW_ID (composition.js): one in another shape is replaced on
 * read, without a word.
 *
 * @param {Array<Array<Array<Object>>>} rows each row a list of columns, each
 *   column a list of elements; columns share the row's width as evenly as
 *   whole numbers allow
 */
function rowsBlock(rows) {
  const state = {
    ...emptyState(),
    rows: rows.map((columns, rowIndex) => {
      const widths = evenWidths(columns.length);
      return {
        id: `row-fixture-${rowIndex + 1}`,
        columns: columns.map((elements, index) => ({
          width: widths[index],
          elements,
        })),
      };
    }),
  };
  return {
    type: 'blockBuilderBlock',
    builderState: serialiseState(state),
    builderHtml: generate(state),
  };
}

const modelWith = (...blocks) => ({ mainBlocks: { blocks } });

module.exports = {
  composedBlock,
  rowsBlock,
  element,
  text,
  button,
  image,
  modelWith,
};
