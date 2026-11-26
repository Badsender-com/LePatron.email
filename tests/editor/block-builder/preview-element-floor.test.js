/**
 * @jest-environment jsdom
 */

'use strict';

// Every element of the preview is at least 24px tall, so an empty one can
// still be clicked and dropped against — and never at most. Found in a
// browser: the floor was a `height`, which is a floor on a <td> only. Inside
// a column the marked node is a <div>, and there it cut every element to 24px:
// an image spilled over the rows under it, and the mobile stacking was hidden
// behind the overlap.

const { openModal, unmountAll, rowsOf } = require('./drag-helpers.js');

afterEach(unmountAll);

const styleOf = (doc, node) => doc.defaultView.getComputedStyle(node);

describe('the floor of a preview element', () => {
  it('is a minimum on an element inside a column', async () => {
    const { modal, doc } = await openModal(['image', 'text']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    modal.renderPreview();

    const elements = rowsOf(doc);
    expect(elements.length).toBeGreaterThan(0);
    elements.forEach((element) => {
      expect(element.tagName).toBe('DIV');
      const style = styleOf(doc, element);
      expect(style.minHeight).toBe('24px');
      expect(style.height).not.toBe('24px');
    });
  });

  // `min-height` does nothing on a table cell: there, `height` is the floor.
  it('is a height on the cell of a flat block', async () => {
    const { doc } = await openModal(['text']);

    const [cell] = rowsOf(doc);
    expect(cell.tagName).toBe('TD');
    expect(styleOf(doc, cell).height).toBe('24px');
  });
});

// Its 120px outranks the floor on a cell. jsdom weighs rules by their order
// only, not by their specificity: a browser smoke is what checks the cell.
describe('the frame of an image with no source', () => {
  it.each([
    ['in a flat block', 1],
    ['in a column', 2],
  ])('is 120px tall %s', async (name, columns) => {
    const { modal, doc } = await openModal(['image']);
    if (columns > 1) {
      modal.setRowWidths(modal.state.rows[0].id, [50, 50]);
      modal.renderPreview();
    }

    const [frame] = rowsOf(doc);
    expect(frame.hasAttribute('data-lp-starter')).toBe(true);
    expect(styleOf(doc, frame).height).toBe('120px');
  });
});
