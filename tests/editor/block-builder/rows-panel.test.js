/**
 * @jest-environment jsdom
 */

'use strict';

// The rows panel: the list of rows, and the structure of the selected one —
// its presets and its widths.
//
// Through the French dictionary, substituted as the editor does (`vm.tt`), so
// a label is read as a user reads it.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const fr = require('../../../public/lang/badsender-fr.js');
const {
  MIN_COLUMN_WIDTH,
  FULL_WIDTH,
} = require('../../../packages/shared/block-builder/composition.js');

const t = (key, params) =>
  Object.keys(params || {}).reduce(
    (text, name) => text.replace(new RegExp(`__${name}__`, 'g'), params[name]),
    fr[key] || key
  );

async function openWith(types) {
  const { modal } = open(null, { t, showDialogGallery: () => false });
  types.forEach((type) => modal.addElement(type));
  await Vue.nextTick();
  return modal;
}

const rowOptions = () =>
  Array.from(document.querySelectorAll('.bb-modal__rows [role="option"]'));
const widthFields = () =>
  Array.from(document.querySelectorAll('.bb-modal__width input'));

function press(target, key) {
  const event = new window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function change(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

afterEach(unmountAll);

describe('the row list', () => {
  it('names each row by its place and its columns', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.setRowWidths(modal.state.rows[1].id, [33, 33, 34]);
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.textContent.trim())).toEqual([
      'Ligne 1 · 1 colonne',
      'Ligne 2 · 3 colonnes',
    ]);
  });

  // One Tab stop for the whole list, as the element list below it.
  it('puts the only tab stop on the selected row, or the first', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.addRow();
    modal.selectElement(modal.state.rows[0].columns[0].elements[0].id);
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.tabIndex)).toEqual([0, -1, -1]);

    modal.selectRow(modal.state.rows[2].id);
    await Vue.nextTick();

    expect(rowOptions().map((option) => option.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('selects with Enter and with Space', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    await Vue.nextTick();
    const [first, second] = modal.state.rows;

    expect(press(rowOptions()[0], 'Enter').defaultPrevented).toBe(true);
    expect(modal.selectedRowId).toBe(first.id);

    expect(press(rowOptions()[1], ' ').defaultPrevented).toBe(true);
    expect(modal.selectedRowId).toBe(second.id);
  });

  it('walks the rows with the arrows, focus following', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    modal.addRow();
    modal.selectRow(modal.state.rows[2].id);
    await Vue.nextTick();

    press(rowOptions()[2], 'ArrowUp');
    await Vue.nextTick();

    expect(modal.selectedRowId).toBe(modal.state.rows[1].id);
    expect(document.activeElement).toBe(rowOptions()[1]);

    press(rowOptions()[1], 'ArrowDown');
    await Vue.nextTick();

    expect(modal.selectedRowId).toBe(modal.state.rows[2].id);
    expect(document.activeElement).toBe(rowOptions()[2]);
  });

  it('stops at the ends of the list', async () => {
    const modal = await openWith(['text']);
    modal.addRow();
    await Vue.nextTick();
    const last = modal.state.rows[1];

    press(rowOptions()[1], 'ArrowDown');

    expect(modal.selectedRowId).toBe(last.id);
  });

  // The two lists share the motif, and neither walks into the other.
  it('leaves the element list alone', async () => {
    const modal = await openWith(['text', 'button']);
    modal.addRow();
    modal.selectRow(modal.state.rows[0].id);
    await Vue.nextTick();

    press(rowOptions()[0], 'ArrowDown');
    await Vue.nextTick();

    expect(document.activeElement).toBe(rowOptions()[1]);
    expect(modal.selectedElementId).toBeNull();
  });
});

describe('the widths', () => {
  async function halves() {
    const modal = await openWith(['text']);
    const [row] = modal.state.rows;
    modal.selectRow(row.id);
    modal.setRowWidths(row.id, [50, 50]);
    await Vue.nextTick();
    return modal;
  }

  const widthsOf = (modal) =>
    modal.state.rows[0].columns.map((column) => column.width);

  it('are bounded by the limits a row has', async () => {
    await halves();

    widthFields().forEach((field) => {
      expect(field.min).toBe(String(MIN_COLUMN_WIDTH));
      expect(field.max).toBe(String(FULL_WIDTH));
    });
  });

  it('name the column each one sets', async () => {
    await halves();

    expect(
      widthFields().map((field) => field.getAttribute('aria-label'))
    ).toEqual(['Largeur de la colonne 1', 'Largeur de la colonne 2']);
  });

  // The state does not change, so Vue has nothing to redraw: the field is put
  // back by hand, or it shows a width the row does not have.
  it('put a refused width back to what the row holds', async () => {
    const modal = await halves();
    const [field] = widthFields();

    change(field, '5');

    expect(widthsOf(modal)).toEqual([50, 50]);
    expect(field.value).toBe('50');
  });

  it('show an accepted width as the row rounded it', async () => {
    const modal = await halves();
    const [field] = widthFields();

    change(field, '33.6');
    await Vue.nextTick();

    expect(widthsOf(modal)).toEqual([34, 66]);
    expect(widthFields().map((input) => input.value)).toEqual(['34', '66']);
  });
});

describe('a change of structure', () => {
  it('keeps whatever else a column holds', async () => {
    const modal = await openWith(['text']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    modal.state.rows[0].columns[0].background = '#ffcc00';

    modal.setRowWidths(row.id, [66, 34]);

    expect(modal.state.rows[0].columns[0]).toEqual(
      expect.objectContaining({ width: 66, background: '#ffcc00' })
    );
  });

  // The preset already active, clicked again: nothing to rebuild, and nothing
  // for the preview to redraw.
  it('leaves the row alone when the widths are the ones it has', async () => {
    const modal = await openWith(['text']);
    const [row] = modal.state.rows;
    modal.setRowWidths(row.id, [50, 50]);
    const columns = modal.state.rows[0].columns;

    expect(modal.setRowWidths(row.id, [50, 50])).toBe(false);
    expect(modal.state.rows[0].columns).toBe(columns);
  });

  // The preview watches its markup: asking for a render as well would redraw
  // the iframe even when the markup did not move.
  it('leaves the render to the preview', async () => {
    const modal = await openWith(['text']);
    const render = jest.spyOn(modal, 'scheduleRender');

    modal.setRowWidths(modal.state.rows[0].id, [50, 50]);

    expect(render).not.toHaveBeenCalled();
  });
});
