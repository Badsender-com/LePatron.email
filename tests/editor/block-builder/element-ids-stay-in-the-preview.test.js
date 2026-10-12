/**
 * @jest-environment jsdom
 */

'use strict';

// Element ids are editing chrome, and they were shipping to recipients.
//
// `data-lp-el` is what the preview uses to know which element a click or a drag
// landed on. It was written into every generated row unconditionally, which
// meant it travelled into `builderHtml`, into the stored mailing, and into the
// exported email — where nothing strips it, because the markup is substituted
// verbatim at the very end of the export, after every other pass has run.
//
// So the two paths have to be told apart, and this is where that is pinned:
// the preview asks for the ids, the block that gets applied does not.

const { openModal, rowsOf, ELEMENT_ATTRIBUTE } = require('./drag-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the preview is marked up for editing', () => {
  it('carries an id on every row', async () => {
    const { doc } = await openModal(['text', 'button']);

    const rows = rowsOf(doc);
    expect(rows).toHaveLength(2);
    rows.forEach((row) =>
      expect(row.getAttribute(ELEMENT_ATTRIBUTE)).toBeTruthy()
    );
  });
});

describe('what the block stores carries none of it', () => {
  it('leaves the ids out of the applied markup', async () => {
    const { modal } = await openModal(['text', 'button']);

    expect(modal.html).not.toContain(ELEMENT_ATTRIBUTE);
  });

  it('writes that same markup through the accessor', async () => {
    const { modal } = await openModal(['text']);
    const written = [];
    modal.accessor = (next) => {
      if (next !== undefined) written.push(next);
      return written[written.length - 1] || '';
    };
    modal.stateAccessor = null;

    modal.handleApply();

    expect(written).toHaveLength(1);
    expect(written[0]).not.toContain(ELEMENT_ATTRIBUTE);
    expect(written[0]).toContain('<table');
  });
});
