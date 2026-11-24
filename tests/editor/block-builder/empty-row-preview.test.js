/**
 * @jest-environment jsdom
 */

'use strict';

// A row just added holds nothing, and what holds nothing is not written. The
// preview shows it all the same: it is where the next element goes, and a row
// nobody can see cannot be filled.

const { openModal, unmountAll, EMPTY_DROP_ID } = require('./drag-helpers.js');

afterEach(unmountAll);

const columnsOfRow = (doc, rowId) =>
  Array.prototype.slice.call(
    doc.body.querySelectorAll(`.lp-bb-col[data-lp-row="${rowId}"]`)
  );

const stylesheet = (doc) => doc.querySelector('style').textContent;

describe('an empty row in the preview', () => {
  it('shows a row just added, as a column to drop into', async () => {
    const { modal, doc } = await openModal(['text']);

    modal.addRow();
    modal.renderPreview();

    const added = modal.state.rows[1];
    expect(columnsOfRow(doc, added.id)).toHaveLength(1);
    expect(columnsOfRow(doc, added.id)[0].innerHTML).toBe('');
  });

  it('shows the empty columns of a block holding nothing, and no other zone', async () => {
    const { modal, doc } = await openModal([]);

    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);
    modal.renderPreview();

    expect(columnsOfRow(doc, modal.state.rows[0].id)).toHaveLength(2);
    expect(doc.getElementById(EMPTY_DROP_ID)).toBeNull();
  });

  it('never writes it into the block', async () => {
    const { modal, markup } = await openModal(['text']);
    const before = modal.html;
    modal.addRow();

    modal.handleApply();

    expect(markup()).not.toMatch(/lp-bb-|data-lp-/);
    expect(markup()).toBe(before);
  });
});

describe('the height of a column in the preview', () => {
  // A floor on every column made a preview of fifty rows 60% taller than the
  // email it shows.
  it('gives a floor to the empty column only', async () => {
    const { doc } = await openModal([]);
    const css = stylesheet(doc);

    expect(css).toContain('.lp-bb-col:empty{min-height:40px;}');
    expect(css).not.toMatch(/\.lp-bb-col\{[^}]*min-height/);
  });

  it('outlines the empty column at rest, not only during a drag', async () => {
    const { doc } = await openModal([]);

    expect(stylesheet(doc)).toMatch(/\.lp-bb-col:empty[,{][^}]*outline:/);
  });
});
