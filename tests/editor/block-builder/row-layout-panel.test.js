/**
 * @jest-environment jsdom
 */

'use strict';

// The bar of the structure panel (#1683): the 600px of the block cut into
// columns and gutters, with a handle between two pieces and a field per piece.
// Moving a handle widens the piece on its left and takes from the one on its
// right; a field takes from the next column.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const fr = require('../../../public/lang/badsender-fr.js');
const {
  MAX_GUTTER,
} = require('../../../packages/shared/block-builder/row-spacing.js');
const {
  MIN_COLUMN_WIDTH,
} = require('../../../packages/shared/block-builder/row-layout.js');

const t = (key, params) =>
  Object.keys(params || {}).reduce(
    (text, name) => text.replace(new RegExp(`__${name}__`, 'g'), params[name]),
    fr[key] || key
  );

afterEach(unmountAll);

async function openWith(widths) {
  const { modal } = open(null, { t, showDialogGallery: () => false });
  modal.addElement('text');
  const [row] = modal.state.rows;
  modal.selectRow(row.id);
  if (widths) modal.setRowWidths(row.id, widths);
  await Vue.nextTick();
  return { modal, row: modal.state.rows[0] };
}

const handles = () =>
  Array.from(
    document.querySelectorAll('.bb-modal__row-layout-bar [role="slider"]')
  );
const fields = () =>
  Array.from(document.querySelectorAll('.bb-modal__pieces input'));
const widthsOf = (row) => row.columns.map((column) => column.width);

function change(input, value, { badInput = false } = {}) {
  input.value = value;
  if (badInput) {
    Object.defineProperty(input, 'validity', { value: { badInput: true } });
  }
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function key(target, name, modifiers) {
  target.dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    })
  );
}

// jsdom lays nothing out: the bar is given the width it would have, 300px for
// the 600px of the block, so one pixel on screen is two in the email.
function layOutBar(width = 300) {
  const bar = document.querySelector('.bb-modal__row-layout-bar');
  bar.getBoundingClientRect = () => ({ left: 0, width });
}

function pointer(target, type, clientX) {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    button: 0,
  });
  target.dispatchEvent(event);
}

describe('the bar', () => {
  it('is not offered for a row of one column', async () => {
    await openWith();

    expect(document.querySelector('.bb-modal__row-layout-bar')).toBeNull();
  });

  // `.bb-modal__layout` is the modal's three-column grid: the section, given
  // that class too, was laid out as one, a flex row a few pixels wide.
  it('sits in a section of its own, not in the modal grid', async () => {
    await openWith([50, 50]);
    const bar = document.querySelector('.bb-modal__row-layout-bar');

    expect(bar.closest('.bb-modal__row-layout')).not.toBeNull();
    expect(document.querySelectorAll('.bb-modal__layout')).toHaveLength(1);
  });

  it('cuts a row into columns and gutters, a handle between two', async () => {
    await openWith([33, 33, 34]);

    expect(fields()).toHaveLength(5);
    expect(handles()).toHaveLength(4);
    expect(
      Array.from(
        document.querySelectorAll('.bb-modal__bar-size'),
        (size) => size.textContent
      )
    ).toEqual(['198', '0', '198', '0', '204']);
  });

  it('names each handle by what it sizes, with its bounds', async () => {
    await openWith([50, 50]);
    const [column, gutter] = handles();

    expect(column.getAttribute('aria-label')).toBe('Largeur de la colonne 1');
    expect(column.getAttribute('aria-valuenow')).toBe('300');
    // Its neighbour is the gutter, from 0 to 40.
    expect(column.getAttribute('aria-valuemin')).toBe(String(300 - MAX_GUTTER));
    expect(column.getAttribute('aria-valuemax')).toBe('300');
    expect(gutter.getAttribute('aria-label')).toBe('Largeur de la gouttière 1');
    expect(gutter.getAttribute('aria-valuemin')).toBe('0');
    expect(gutter.getAttribute('aria-valuemax')).toBe(String(MAX_GUTTER));
  });
});

describe('a handle from the keyboard', () => {
  it('moves one pixel with an arrow, ten with Shift', async () => {
    const { row } = await openWith([50, 50]);
    const [, gutter] = handles();

    key(gutter, 'ArrowRight');
    key(gutter, 'ArrowRight', { shiftKey: true });
    await Vue.nextTick();

    expect(row.gutters).toEqual([11]);
    expect(widthsOf(row)).toEqual([300, 289]);
    expect(handles()[1].getAttribute('aria-valuenow')).toBe('11');
  });

  it('stops at a bound rather than past it', async () => {
    const { row } = await openWith([50, 50]);
    const [, gutter] = handles();

    key(gutter, 'End');
    key(gutter, 'ArrowRight', { shiftKey: true });

    expect(row.gutters).toEqual([MAX_GUTTER]);
  });

  it('narrows a column into the gutter beside it', async () => {
    const { row } = await openWith([50, 50]);
    const [column] = handles();

    key(column, 'ArrowLeft', { shiftKey: true });

    expect(widthsOf(row)).toEqual([290, 300]);
    expect(row.gutters).toEqual([10]);
  });
});

describe('a handle dragged', () => {
  it('opens the gutter it is the edge of', async () => {
    const { row } = await openWith([50, 50]);
    layOutBar();
    const [, gutter] = handles();

    pointer(gutter, 'pointerdown', 150);
    pointer(window, 'pointermove', 160);
    pointer(window, 'pointerup', 160);

    expect(row.gutters).toEqual([20]);
    expect(widthsOf(row)).toEqual([300, 280]);
  });

  // At 0, the two edges of a gutter are one spot: going right opens it.
  it('opens a closed gutter when its column’s edge goes right', async () => {
    const { row } = await openWith([50, 50]);
    layOutBar();
    const [column] = handles();

    pointer(column, 'pointerdown', 150);
    pointer(window, 'pointermove', 155);

    expect(row.gutters).toEqual([10]);
    expect(widthsOf(row)).toEqual([300, 290]);
  });

  it('stops following the pointer once released', async () => {
    const { row } = await openWith([50, 50]);
    layOutBar();
    const [, gutter] = handles();

    pointer(gutter, 'pointerdown', 150);
    pointer(window, 'pointermove', 155);
    pointer(window, 'pointerup', 155);
    pointer(window, 'pointermove', 170);

    expect(row.gutters).toEqual([10]);
  });
});

describe('the fields', () => {
  it('are named by their visible label (WCAG 2.5.3)', async () => {
    await openWith([50, 50]);

    expect(
      fields().map(
        (input) =>
          document.getElementById(input.getAttribute('aria-labelledby'))
            .textContent
      )
    ).toEqual(['Colonne 1', 'Gouttière 1', 'Colonne 2']);
  });

  it('show the last column as what the others leave', async () => {
    await openWith([50, 50]);

    expect(fields().map((input) => input.disabled)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('set a gutter on its own, the next column giving the room', async () => {
    const { row } = await openWith([33, 33, 34]);

    change(fields()[3], '24');

    expect(row.gutters).toEqual([0, 24]);
    expect(widthsOf(row)).toEqual([198, 198, 180]);
  });

  it('set a column, the next column giving the room, the gutter kept', async () => {
    const { row } = await openWith([50, 50]);
    change(fields()[1], '20');

    change(fields()[0], '250');

    expect(widthsOf(row)).toEqual([250, 330]);
    expect(row.gutters).toEqual([20]);
  });

  test.each([
    ['a column below the minimum', 0, String(MIN_COLUMN_WIDTH - 1)],
    ['a gutter past the maximum', 1, String(MAX_GUTTER + 1)],
    ['a column that leaves the next one too narrow', 0, '560'],
  ])('put back %s', async (_label, index, typed) => {
    const { row } = await openWith([50, 50]);

    change(fields()[index], typed);

    expect(widthsOf(row)).toEqual([300, 300]);
    expect(row).not.toHaveProperty('gutters');
    expect(fields()[index].value).toBe(index === 1 ? '0' : '300');
  });

  it('keep what the row holds when the browser cannot read one', async () => {
    const { row } = await openWith([50, 50]);
    change(fields()[1], '12');

    change(fields()[1], '', { badInput: true });

    expect(row.gutters).toEqual([12]);
    expect(fields()[1].value).toBe('12');
  });

  it('store no gutters once they are all back to 0', async () => {
    const { row } = await openWith([50, 50]);
    change(fields()[1], '12');

    change(fields()[1], '0');

    expect(row).not.toHaveProperty('gutters');
    expect(widthsOf(row)).toEqual([300, 300]);
  });
});

describe('a preset', () => {
  const pressed = () =>
    Array.from(
      document.querySelectorAll('.bb-modal__preset[aria-pressed="true"]'),
      (button) => button.getAttribute('aria-label')
    );

  it('is no longer active once a column moves', async () => {
    const { row } = await openWith([50, 50]);
    change(fields()[1], '20');
    await Vue.nextTick();

    // 300 / 280 is not half and half of what the gutter leaves.
    expect(widthsOf(row)).toEqual([300, 280]);
    expect(pressed()).toEqual([]);
  });

  it('shares what the gutters leave, and is active again', async () => {
    const { modal, row } = await openWith([50, 50]);
    change(fields()[1], '20');

    modal.applyPreset(modal.presets.find((preset) => preset.key === 'halves'));
    await Vue.nextTick();

    expect(widthsOf(row)).toEqual([290, 290]);
    expect(row.gutters).toEqual([20]);
    expect(pressed()).toEqual([fr['block-builder-structure-halves']]);
  });
});
