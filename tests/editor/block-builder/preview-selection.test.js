/**
 * @jest-environment jsdom
 */

'use strict';

// Selecting an element by clicking it in the preview.
//
// Before this, the only way to reach an element's settings was the list on the
// left — so correcting the button you were looking at meant working out which
// line of the list it was. The preview already carried what was needed:
// `data-lp-el` on every generated row, and an iframe that is same-origin (no
// `src`, and `sandbox` keeps `allow-same-origin`), so the parent can listen on
// its document even though scripts inside it cannot run.
//
// Two things here are not decoration. The preview holds real links — a button
// renders an `<a href>` — so a click that is not cancelled navigates the iframe
// away from the composition. And the preview document must actually be written
// by us, or its stylesheet never exists.

const Vue = require('vue/dist/vue.common');

const { openModal, rowOf, SELECTED_CLASS } = require('./drag-helpers.js');

/** Dispatches a real click inside the preview document. */
function clickIn(doc, element) {
  const event = new doc.defaultView.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the preview document', () => {
  // A fresh src-less iframe is already at about:blank WITH an empty body, so
  // guarding the write on `!doc.body` skipped it — and skipped the stylesheet
  // with it.
  it('is written by us, stylesheet included', async () => {
    const { doc } = await openModal(['text']);

    expect(doc.querySelector('style')).not.toBeNull();
    expect(doc.querySelector('style').textContent).toContain(SELECTED_CLASS);
  });

  it('is written once, not on every render', async () => {
    const { modal, doc } = await openModal(['text']);
    const first = doc.querySelector('style');

    modal.renderPreview();
    modal.renderPreview();

    expect(
      modal.$refs.previewFrame.contentDocument.querySelector('style')
    ).toBe(first);
  });
});

describe('clicking an element in the preview', () => {
  it('selects the one that was clicked', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [, second] = modal.state.elements;
    modal.selectedId = null;

    clickIn(doc, rowOf(doc, second.id));

    expect(modal.selectedId).toBe(second.id);
    expect(modal.selected.type).toBe('button');
  });

  // Nobody clicks the row: they click a word, or a pixel of an image.
  it('selects it from a click on something inside it', async () => {
    const { modal, doc } = await openModal(['button']);
    const [element] = modal.state.elements;
    modal.selectedId = null;

    const link = doc.body.querySelector('a');
    expect(link).not.toBeNull();
    clickIn(doc, link);

    expect(modal.selectedId).toBe(element.id);
  });

  // A button renders a real `<a href>`. An uncancelled click navigates the
  // iframe, and the composition is gone.
  it('cancels the click, so a link cannot navigate the preview', async () => {
    const { doc } = await openModal(['button']);

    const event = clickIn(doc, doc.body.querySelector('a'));

    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps the current selection when the click lands on nothing', async () => {
    const { modal, doc } = await openModal(['text']);
    const [element] = modal.state.elements;

    clickIn(doc, doc.body);

    expect(modal.selectedId).toBe(element.id);
  });
});

describe('the selected element is outlined in the preview', () => {
  it('marks the selected row and no other', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [first, second] = modal.state.elements;

    // addElement selected the last one.
    expect(rowOf(doc, second.id).classList.contains(SELECTED_CLASS)).toBe(true);
    expect(rowOf(doc, first.id).classList.contains(SELECTED_CLASS)).toBe(false);
  });

  // Selection moves from the list on the left; only the outline should move,
  // without the body being rewritten — rewriting it refetches every image.
  it('follows a selection made outside the preview', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [first, second] = modal.state.elements;
    const row = rowOf(doc, first.id);

    modal.selectedId = first.id;
    await Vue.nextTick();

    expect(rowOf(doc, first.id)).toBe(row);
    expect(row.classList.contains(SELECTED_CLASS)).toBe(true);
    expect(rowOf(doc, second.id).classList.contains(SELECTED_CLASS)).toBe(
      false
    );
  });

  it('survives a re-render, which replaces the body', async () => {
    const { modal, doc } = await openModal(['text', 'button']);
    const [, second] = modal.state.elements;

    modal.renderPreview();

    expect(rowOf(doc, second.id).classList.contains(SELECTED_CLASS)).toBe(true);
  });

  it('outlines nothing when nothing is selected', async () => {
    const { modal, doc } = await openModal(['text']);

    modal.selectedId = null;
    await Vue.nextTick();

    expect(doc.body.querySelectorAll(`.${SELECTED_CLASS}`)).toHaveLength(0);
  });
});
