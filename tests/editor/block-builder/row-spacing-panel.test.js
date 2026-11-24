/**
 * @jest-environment jsdom
 */

'use strict';

// The stack spacing of a row, in the structure panel (#1683): the space
// between its columns once they stack on a phone, set per row, only for a row
// of several columns. And what a change of structure, or a duplication, does
// to the row's spacing. The bar that sets the gutters is
// row-layout-panel.test.js.
//
// Through the French dictionary, substituted as the editor does, so a label is
// read as a user reads it.

const Vue = require('vue/dist/vue.common');

const { open, unmountAll } = require('./modal-helpers.js');
const fr = require('../../../public/lang/badsender-fr.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  isFlatComposition,
} = require('../../../packages/shared/block-builder/composition.js');
const {
  MAX_STACK_SPACING,
  STACK_SPACING_STEP,
} = require('../../../packages/shared/block-builder/row-spacing.js');

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

const field = () => document.querySelector('.bb-modal__spacing input');

function change(input, value, { badInput = false } = {}) {
  input.value = value;
  // jsdom never reports a number field it could not read: told here, as a
  // browser would for `20px`, which leaves the field empty.
  if (badInput) {
    Object.defineProperty(input, 'validity', { value: { badInput: true } });
  }
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

describe('the stack spacing field', () => {
  it('is not offered for a row of one column', async () => {
    await openWith();

    expect(document.querySelector('.bb-modal__structure')).not.toBeNull();
    expect(field()).toBeNull();
  });

  test.each([[[50, 50]], [[33, 33, 34]]])(
    'is offered for a row of %j',
    async (widths) => {
      await openWith(widths);

      expect(field()).not.toBeNull();
    }
  );

  // WCAG 2.5.3: the name a voice command uses is the one on screen.
  it('is named by its visible label, and explained by the note', async () => {
    await openWith([50, 50]);
    const label = document.getElementById(
      field().getAttribute('aria-labelledby')
    );
    const hint = document.getElementById(
      field().getAttribute('aria-describedby')
    );

    expect(field().hasAttribute('aria-label')).toBe(false);
    expect(label.textContent.trim()).toBe('Espacement empilé (mobile)');
    expect(hint.textContent.trim()).toBe(
      `Par pas de ${STACK_SPACING_STEP} px : une autre valeur est arrondie au plus proche.`
    );
  });

  it('is bounded by the limits a row has', async () => {
    await openWith([50, 50]);

    expect(field().min).toBe('0');
    expect(field().max).toBe(String(MAX_STACK_SPACING));
    expect(field().step).toBe(String(STACK_SPACING_STEP));
  });

  it('starts at 0', async () => {
    await openWith([50, 50]);

    expect(field().value).toBe('0');
  });
});

describe('setting the stack spacing', () => {
  it('stores it on its step, and shows it', async () => {
    const { row } = await openWith([50, 50]);

    change(field(), '13');

    expect(row.stackSpacing).toBe(12);
    expect(field().value).toBe('12');
  });

  // The state does not change, so Vue has nothing to redraw: the field is put
  // back by hand.
  test.each([
    ['past the maximum', String(MAX_STACK_SPACING + 1)],
    ['negative', '-4'],
  ])(
    'puts a refused value %s back to what the row holds',
    async (_l, typed) => {
      const { row } = await openWith([50, 50]);
      change(field(), '8');

      change(field(), typed);

      expect(row.stackSpacing).toBe(8);
      expect(field().value).toBe('8');
    }
  );

  it('keeps what the row holds when the browser cannot read the field', async () => {
    const { row } = await openWith([50, 50]);
    change(field(), '8');

    change(field(), '', { badInput: true });

    expect(row.stackSpacing).toBe(8);
    expect(field().value).toBe('8');
  });

  it('writes no key once emptied or set back to 0', async () => {
    const { modal, row } = await openWith([50, 50]);
    change(field(), '8');

    change(field(), '');

    expect(row).not.toHaveProperty('stackSpacing');
    expect(serialiseState(modal.state)).not.toMatch(/stackSpacing/);
  });

  it('is refused on a row of one column', async () => {
    const { modal, row } = await openWith();

    expect(modal.setRowStackSpacing(row.id, 12)).toBe(false);
    expect(row).not.toHaveProperty('stackSpacing');
  });
});

describe('a change of structure', () => {
  async function spaced() {
    const opened = await openWith([50, 50]);
    opened.modal.setRowPiece(opened.row.id, 1, 20);
    change(field(), '12');
    return opened;
  }

  it('keeps the spacing of a row that still has several columns', async () => {
    const { modal, row } = await spaced();

    modal.setRowWidths(row.id, [33, 33, 34]);

    expect(row).toMatchObject({ gutters: [20, 0], stackSpacing: 12 });
  });

  // Applying a preset keeps the gutters: the columns share what they leave.
  it('gives the columns the proportions of what the gutters leave', async () => {
    const { modal, row } = await spaced();

    modal.setRowWidths(row.id, [50, 50]);
    modal.setRowWidths(row.id, [66, 34]);

    expect(row.columns.map((column) => column.width)).toEqual([383, 197]);
  });

  it('removes it from a row that goes down to one column, which stays flat', async () => {
    const { modal, row } = await spaced();

    modal.setRowWidths(row.id, [100]);
    await Vue.nextTick();

    expect(row).not.toHaveProperty('gutters');
    expect(row).not.toHaveProperty('stackSpacing');
    expect(isFlatComposition(modal.state)).toBe(true);
    expect(field()).toBeNull();
  });

  it('starts again at 0 when the row gets its columns back', async () => {
    const { modal, row } = await spaced();
    modal.setRowWidths(row.id, [100]);

    modal.setRowWidths(row.id, [50, 50]);
    await Vue.nextTick();

    expect(field().value).toBe('0');
    expect(row).not.toHaveProperty('gutters');
  });
});

describe('a duplicated row', () => {
  it('keeps the spacing of the row it copies', async () => {
    const { modal, row } = await openWith([50, 50]);
    modal.setRowPiece(row.id, 1, 16);
    change(field(), '8');

    const copy = modal.duplicateRow(row.id);

    expect(copy).toMatchObject({ gutters: [16], stackSpacing: 8 });
    expect(copy.columns.map((column) => column.width)).toEqual([300, 284]);
    expect(copy.id).not.toBe(row.id);
  });
});
