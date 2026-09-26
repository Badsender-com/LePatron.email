/**
 * @jest-environment jsdom
 */

'use strict';

// Dragging an element from the palette into the preview.
//
// The paradigm it replaces — a "+ Texte" button and a pair of arrows — works,
// but it is not what anyone recognises as an email builder, and it could not be
// shown to a client. What is pinned here is the behaviour that makes the drag
// usable rather than merely present:
//
//   - the drop lands WHERE the cursor is, not at the end;
//   - the preview does not re-render mid-drag, or the nodes under the cursor
//     are destroyed and the drag ends on nothing;
//   - a dropped element is selected and already says something, so it is
//     visible and editable without a second gesture;
//   - clicking the palette still appends, which is the quick path, the
//     keyboard path, and the fallback.

const Vue = require('vue/dist/vue.common');

const {
  BlockBuilderModalComponent,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/block-builder-modal.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

const DROP_BEFORE = 'lp-bb-drop-before';
const DROP_AFTER = 'lp-bb-drop-after';
const DRAGGING = 'lp-bb-dragging';
const SELECTED = 'lp-bb-selected';

function accessorOf(initial) {
  let value = initial === undefined ? '' : initial;
  return (next) => {
    if (next === undefined) return value;
    value = next;
    return value;
  };
}

async function open(types) {
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

  return { modal, doc: modal.$refs.previewFrame.contentDocument };
}

/** A stand-in for the DataTransfer the browser hands a real drag. */
const transfer = () => ({
  effectAllowed: null,
  dropEffect: null,
  data: {},
  setData(type, value) {
    this.data[type] = value;
  },
  getData(type) {
    return this.data[type];
  },
});

const rows = (doc) =>
  Array.prototype.slice.call(
    doc.body.querySelectorAll(`[${ELEMENT_ATTRIBUTE}]`)
  );

/**
 * jsdom lays nothing out, so every box is zero. Each row is given a height and
 * a position so the midpoint arithmetic has something real to work on.
 */
function layOutRows(doc, height) {
  rows(doc).forEach((row, index) => {
    row.getBoundingClientRect = () => ({
      top: index * height,
      bottom: (index + 1) * height,
      height,
    });
  });
}

const dragOver = (modal, doc, clientY) => {
  const event = new doc.defaultView.Event('dragover', {
    bubbles: true,
    cancelable: true,
  });
  event.clientY = clientY;
  event.dataTransfer = transfer();
  doc.body.dispatchEvent(event);
  return event;
};

const drop = (modal, doc, clientY) => {
  const event = new doc.defaultView.Event('drop', {
    bubbles: true,
    cancelable: true,
  });
  event.clientY = clientY;
  event.dataTransfer = transfer();
  doc.body.dispatchEvent(event);
  return event;
};

const startDrag = (modal, type) => {
  const event = { dataTransfer: transfer() };
  modal.handleDragStart(type, event);
  return event;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('starting a drag from the palette', () => {
  // `setData` is not optional: without it Firefox never starts the drag at all.
  it('records the type, puts it on the dataTransfer, and marks it a copy', async () => {
    const { modal, doc } = await open(['text']);

    const event = startDrag(modal, 'image');

    expect(modal.draggingType).toBe('image');
    expect(event.dataTransfer.getData('text/plain')).toBe('image');
    expect(event.dataTransfer.effectAllowed).toBe('copy');
    expect(doc.body.classList.contains(DRAGGING)).toBe(true);
  });
});

describe('the insertion point follows the cursor', () => {
  // The one rule of the HTML5 drag API everybody forgets: without this the
  // browser refuses the drop outright.
  it('cancels dragover, or no drop is possible at all', async () => {
    const { modal, doc } = await open(['text']);
    layOutRows(doc, 100);
    startDrag(modal, 'image');

    expect(dragOver(modal, doc, 10).defaultPrevented).toBe(true);
  });

  it('ignores a drag that did not start in our palette', async () => {
    const { modal, doc } = await open(['text']);
    layOutRows(doc, 100);

    expect(dragOver(modal, doc, 10).defaultPrevented).toBe(false);
  });

  it('marks the row the element would land before', async () => {
    const { modal, doc } = await open(['text', 'button']);
    layOutRows(doc, 100);
    startDrag(modal, 'image');

    // Above the midpoint of the second row.
    dragOver(modal, doc, 120);

    expect(modal.dropIndex).toBe(1);
    expect(rows(doc)[1].classList.contains(DROP_BEFORE)).toBe(true);
    expect(rows(doc)[0].classList.contains(DROP_BEFORE)).toBe(false);
  });

  it('marks the last row below it when the cursor is past everything', async () => {
    const { modal, doc } = await open(['text', 'button']);
    layOutRows(doc, 100);
    startDrag(modal, 'image');

    dragOver(modal, doc, 190);

    expect(modal.dropIndex).toBe(2);
    expect(rows(doc)[1].classList.contains(DROP_AFTER)).toBe(true);
  });

  it('shows one indicator at a time', async () => {
    const { modal, doc } = await open(['text', 'button']);
    layOutRows(doc, 100);
    startDrag(modal, 'image');

    dragOver(modal, doc, 10);
    dragOver(modal, doc, 190);

    expect(doc.body.querySelectorAll(`.${DROP_BEFORE}`)).toHaveLength(0);
    expect(doc.body.querySelectorAll(`.${DROP_AFTER}`)).toHaveLength(1);
  });
});

describe('dropping', () => {
  it('inserts at the cursor, not at the end', async () => {
    const { modal, doc } = await open(['text', 'button']);
    layOutRows(doc, 100);
    startDrag(modal, 'divider');

    // Above the midpoint of the first row: before everything.
    drop(modal, doc, 10);

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'divider',
      'text',
      'button',
    ]);
  });

  it('inserts between two elements', async () => {
    const { modal, doc } = await open(['text', 'button']);
    layOutRows(doc, 100);
    startDrag(modal, 'divider');

    drop(modal, doc, 120);

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'text',
      'divider',
      'button',
    ]);
  });

  it('appends when dropped past the last element', async () => {
    const { modal, doc } = await open(['text']);
    layOutRows(doc, 100);
    startDrag(modal, 'spacer');

    drop(modal, doc, 90);

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'text',
      'spacer',
    ]);
  });

  // Dropping and editing should be one gesture, not two.
  it('selects what was dropped', async () => {
    const { modal, doc } = await open(['text']);
    layOutRows(doc, 100);
    startDrag(modal, 'button');

    drop(modal, doc, 90);

    expect(modal.selected.type).toBe('button');
  });

  it('clears the drag state and every indicator', async () => {
    const { modal, doc } = await open(['text']);
    layOutRows(doc, 100);
    startDrag(modal, 'button');
    dragOver(modal, doc, 10);

    drop(modal, doc, 10);

    expect(modal.draggingType).toBeNull();
    expect(doc.body.classList.contains(DRAGGING)).toBe(false);
    expect(doc.body.querySelectorAll(`.${DROP_BEFORE}`)).toHaveLength(0);
  });

  it('ignores a drop carrying a type the palette does not offer', async () => {
    const { modal, doc } = await open(['text']);
    layOutRows(doc, 100);
    modal.draggingType = 'iframe';

    drop(modal, doc, 10);

    expect(modal.state.elements).toHaveLength(1);
  });
});

describe('a dropped element says something', () => {
  // An element that renders nothing appears nowhere — which is exactly how
  // "I added a text and saw nothing" was reported.
  it.each([
    ['text', 'content', 'block-builder-seed-text'],
    ['button', 'label', 'block-builder-seed-button'],
  ])('seeds a %s', async (type, key, translation) => {
    const { modal } = await open([]);

    modal.addElement(type);

    expect(modal.selected[key]).toBe(translation);
  });

  it('renders that seed, so the element is visible at once', async () => {
    const { modal } = await open(['text']);

    expect(modal.html).toContain('block-builder-seed-text');
  });

  // Nothing honest to put in an image; the preview's min-height keeps its slot
  // visible and clickable instead.
  it('leaves the image empty', async () => {
    const { modal } = await open([]);

    modal.addElement('image');

    expect(modal.selected.src).toBe('');
  });
});

describe('the preview holds still during a drag', () => {
  // Replacing the body mid-drag destroys the nodes the cursor is over: the drop
  // target vanishes and the drag ends on nothing.
  it('holds a render that falls due mid-drag', async () => {
    const { modal, doc } = await open(['text']);
    startDrag(modal, 'image');
    const before = doc.body.innerHTML;

    modal.scheduleRender();

    expect(modal.renderHeldDuringDrag).toBe(true);
    expect(doc.body.innerHTML).toBe(before);
  });

  it('renders once the drag is over', async () => {
    const { modal, doc } = await open(['text']);
    startDrag(modal, 'image');
    modal.state.elements[0].content = 'changé après coup';
    modal.scheduleRender();

    modal.handleDragEnd();

    expect(modal.renderHeldDuringDrag).toBe(false);
    expect(doc.body.innerHTML).toContain('changé après coup');
  });
});

describe('an empty block still offers somewhere to drop', () => {
  it('shows a drop target when there is nothing yet', async () => {
    const { doc } = await open([]);

    const zone = doc.getElementById('lp-bb-empty-drop');
    expect(zone).not.toBeNull();
    expect(zone.textContent).toBe('block-builder-drop-here');
  });

  it('takes the target away once something is there', async () => {
    const { modal, doc } = await open([]);

    modal.addElement('text');
    modal.renderPreview();

    expect(doc.getElementById('lp-bb-empty-drop')).toBeNull();
  });

  // The target is preview chrome. It must never reach the generated markup.
  it('keeps it out of what the generator produces', async () => {
    const { modal } = await open([]);

    expect(modal.html).toBe('');
    modal.addElement('text');
    expect(modal.html).not.toContain('lp-bb-empty-drop');
  });
});

describe('clicking the palette still works', () => {
  it('appends, and selects what it appended', async () => {
    const { modal } = await open(['text']);

    modal.addElement('divider');

    expect(modal.state.elements.map((element) => element.type)).toEqual([
      'text',
      'divider',
    ]);
    expect(modal.selected.type).toBe('divider');
  });

  it('marks the selection in the preview too', async () => {
    const { modal, doc } = await open(['text']);

    modal.addElement('divider');
    modal.renderPreview();

    const last = rows(doc)[1];
    expect(last.classList.contains(SELECTED)).toBe(true);
  });
});
