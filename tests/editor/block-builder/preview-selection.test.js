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

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

const SELECTED_CLASS = 'lp-bb-selected';

function accessorOf(initial) {
  let value = initial === undefined ? '' : initial;
  return (next) => {
    if (next === undefined) return value;
    value = next;
    return value;
  };
}

/**
 * Opens the modal, composes, and renders the preview.
 *
 * `renderPreview` is called directly rather than waited for: the real path goes
 * through a requestAnimationFrame, and what is under test is the selection, not
 * the scheduling.
 */
async function openWith(types) {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const app = new Vue({
    el: host,
    components: { BlockBuilderModal: BlockBuilderModalComponent },
    data: {
      vm: {
        t: (key) => key,
        startMultiple: jest.fn(),
        stopMultiple: jest.fn(),
      },
    },
    template: '<block-builder-modal :vm="vm" />',
  });

  const modal = app.$children[0];
  modal.handleToggle(true, {
    accessor: accessorOf(''),
    stateAccessor: accessorOf(''),
  });
  await Vue.nextTick();

  (types || []).forEach((type) => modal.addElement(type));
  modal.renderPreview();

  const doc = modal.$refs.previewFrame.contentDocument;
  return { modal, doc };
}

/** The rendered row carrying an element's id. */
const rowOf = (doc, id) =>
  doc.body.querySelector(`[${ELEMENT_ATTRIBUTE}="${id}"]`);

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
    const { doc } = await openWith(['text']);

    expect(doc.querySelector('style')).not.toBeNull();
    expect(doc.querySelector('style').textContent).toContain(SELECTED_CLASS);
  });

  it('is written once, not on every render', async () => {
    const { modal, doc } = await openWith(['text']);
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
    const { modal, doc } = await openWith(['text', 'button']);
    const [, second] = modal.state.elements;
    modal.selectedId = null;

    clickIn(doc, rowOf(doc, second.id));

    expect(modal.selectedId).toBe(second.id);
    expect(modal.selected.type).toBe('button');
  });

  // Nobody clicks the row: they click a word, or a pixel of an image.
  it('selects it from a click on something inside it', async () => {
    const { modal, doc } = await openWith(['button']);
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
    const { doc } = await openWith(['button']);

    const event = clickIn(doc, doc.body.querySelector('a'));

    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps the current selection when the click lands on nothing', async () => {
    const { modal, doc } = await openWith(['text']);
    const [element] = modal.state.elements;

    clickIn(doc, doc.body);

    expect(modal.selectedId).toBe(element.id);
  });
});

describe('the selected element is outlined in the preview', () => {
  it('marks the selected row and no other', async () => {
    const { modal, doc } = await openWith(['text', 'button']);
    const [first, second] = modal.state.elements;

    // addElement selected the last one.
    expect(rowOf(doc, second.id).classList.contains(SELECTED_CLASS)).toBe(true);
    expect(rowOf(doc, first.id).classList.contains(SELECTED_CLASS)).toBe(false);
  });

  // Selection moves from the list on the left; only the outline should move,
  // without the body being rewritten — rewriting it refetches every image.
  it('follows a selection made outside the preview', async () => {
    const { modal, doc } = await openWith(['text', 'button']);
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
    const { modal, doc } = await openWith(['text', 'button']);
    const [, second] = modal.state.elements;

    modal.renderPreview();

    expect(rowOf(doc, second.id).classList.contains(SELECTED_CLASS)).toBe(true);
  });

  it('outlines nothing when nothing is selected', async () => {
    const { modal, doc } = await openWith(['text']);

    modal.selectedId = null;
    await Vue.nextTick();

    expect(doc.body.querySelectorAll(`.${SELECTED_CLASS}`)).toHaveLength(0);
  });
});
