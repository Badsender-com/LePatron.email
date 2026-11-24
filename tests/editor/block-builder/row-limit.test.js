/**
 * @jest-environment jsdom
 */

'use strict';

// A composition holds at most MAX_ROWS rows: past that, a stored state is
// refused on read (composition.js), the server answers every save with
// BLOCK_BUILDER_STATE_UNREADABLE, and the composition is lost at the next
// opening. So the modal never makes one: "Add a row" is disabled at the limit,
// and Apply refuses a composition the read would not take back.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const {
  MAX_ROWS,
  canAddRow,
  isWritableComposition,
  singleColumnRows,
} = require('../../../packages/shared/block-builder/composition.js');
const fr = require('../../../public/lang/badsender-fr.js');
const en = require('../../../public/lang/badsender-en.js');

afterEach(unmountAll);

let count = 0;
/** A row holding one text, so it is written (see withoutEmptyRows). */
const fullRow = () => {
  count += 1;
  return singleColumnRows([
    { id: `el-${count}`, type: 'text', content: 'x' },
  ])[0];
};
const rows = (n, make) => Array.from({ length: n }, make || fullRow);

/** The modal, opened and holding `n` rows that each hold a text. */
async function withRows(n) {
  const context = open();
  context.modal.state.rows.splice(0, 1, ...rows(n));
  await Vue.nextTick();
  return context;
}

describe('the shared bound', () => {
  it('lets a row be added below the limit, not at it', () => {
    expect(canAddRow({ rows: rows(MAX_ROWS - 1) })).toBe(true);
    expect(canAddRow({ rows: rows(MAX_ROWS) })).toBe(false);
  });

  it('writes what the read takes back, and nothing more', () => {
    expect(isWritableComposition({ rows: rows(MAX_ROWS) })).toBe(true);
    expect(isWritableComposition({ rows: rows(MAX_ROWS + 1) })).toBe(false);
  });

  // An empty row is not written, so it is not counted against the read.
  it('counts the rows that are written', () => {
    const state = { rows: [...rows(MAX_ROWS), ...singleColumnRows()] };

    expect(isWritableComposition(state)).toBe(true);
  });
});

describe('"Add a row"', () => {
  it('adds a bare full-width row and selects it', () => {
    const { modal } = open();
    const render = jest.spyOn(modal, 'scheduleRender');

    const row = modal.addRow();

    expect(modal.state.rows[1]).toBe(row);
    expect(row.columns).toEqual([{ width: 100, elements: [] }]);
    expect(modal.selectedRowId).toBe(row.id);
    // A row holding nothing changes no markup: there is nothing to render.
    expect(render).not.toHaveBeenCalled();
  });

  it(`is disabled at ${MAX_ROWS} rows`, async () => {
    await withRows(MAX_ROWS);

    const button = document.querySelector('.bb-modal__add-row');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toBe('block-builder-row-limit');
  });

  it('is enabled below the limit', async () => {
    await withRows(MAX_ROWS - 1);

    const button = document.querySelector('.bb-modal__add-row');
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('title')).toBe(false);
  });

  it(`adds nothing past ${MAX_ROWS} rows`, async () => {
    const { modal } = await withRows(MAX_ROWS);

    expect(modal.addRow()).toBeNull();
    expect(modal.state.rows).toHaveLength(MAX_ROWS);
  });
});

describe('Apply', () => {
  it(`refuses a composition of ${
    MAX_ROWS + 1
  } rows, and says why`, async () => {
    const { modal, accessor, stateAccessor, vm } = await withRows(MAX_ROWS + 1);

    modal.handleApply();
    await Vue.nextTick();

    expect(accessor.writes).toEqual([]);
    expect(stateAccessor.writes).toEqual([]);
    expect(vm.startMultiple).not.toHaveBeenCalled();
    expect(modal.tooManyRows).toBe(true);
    expect(modal.tooLarge).toBe(false);
    expect(document.querySelector('.bb-modal__error').textContent.trim()).toBe(
      'block-builder-too-many-rows'
    );
  });

  it('lets the message go once rows are removed', async () => {
    const { modal } = await withRows(MAX_ROWS + 1);
    modal.handleApply();

    modal.state.rows.pop();

    expect(modal.tooManyRows).toBe(false);
  });

  it(`applies a composition of ${MAX_ROWS} rows`, async () => {
    const { modal, accessor } = await withRows(MAX_ROWS);

    modal.handleApply();

    expect(accessor.writes).toHaveLength(1);
  });
});

describe('the limit is said in both languages', () => {
  it.each([['block-builder-row-limit'], ['block-builder-too-many-rows']])(
    '%s names the limit in French and English',
    (key) => {
      expect(fr[key]).toContain('__max__');
      expect(en[key]).toContain('__max__');
    }
  );
});
