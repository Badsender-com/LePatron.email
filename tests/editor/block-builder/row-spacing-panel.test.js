/**
 * @jest-environment jsdom
 */

'use strict';

// The space between the columns of a row, in the structure panel (#1683): the
// desktop gutter and the mobile stack spacing, set per row, only for a row of
// several columns.
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
  MAX_GUTTER,
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

const spacingFields = () =>
  Array.from(document.querySelectorAll('.bb-modal__spacing input'));
const gutterField = () => spacingFields()[0];
const stackSpacingField = () => spacingFields()[1];

function change(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

describe('the spacing fields', () => {
  it('are not offered for a row of one column', async () => {
    await openWith();

    expect(document.querySelector('.bb-modal__structure')).not.toBeNull();
    expect(spacingFields()).toEqual([]);
  });

  test.each([[[50, 50]], [[33, 33, 34]]])(
    'are offered for a row of %j',
    async (widths) => {
      await openWith(widths);

      expect(spacingFields()).toHaveLength(2);
    }
  );

  it('say what each one sets, and for which device', async () => {
    await openWith([50, 50]);

    expect(
      Array.from(
        document.querySelectorAll('.bb-modal__spacing-label'),
        (label) => label.textContent.trim()
      )
    ).toEqual(['Gouttière (bureau)', 'Espacement empilé (mobile)']);
    expect(gutterField().getAttribute('aria-label')).toBe(
      fr['block-builder-gutter-label']
    );
    expect(stackSpacingField().getAttribute('aria-label')).toBe(
      fr['block-builder-stack-spacing-label']
    );
  });

  it('are bounded by the limits a row has', async () => {
    await openWith([50, 50]);

    expect(gutterField().min).toBe('0');
    expect(gutterField().max).toBe(String(MAX_GUTTER));
    expect(stackSpacingField().min).toBe('0');
    expect(stackSpacingField().max).toBe(String(MAX_STACK_SPACING));
    expect(stackSpacingField().step).toBe(String(STACK_SPACING_STEP));
  });

  it('say the stack spacing is rounded to its step', async () => {
    await openWith([50, 50]);
    const hint = document.getElementById(
      stackSpacingField().getAttribute('aria-describedby')
    );

    expect(hint.textContent.trim()).toBe(
      `Sur téléphone, arrondi au multiple de ${STACK_SPACING_STEP} px le plus proche.`
    );
  });

  it('start at 0', async () => {
    await openWith([50, 50]);

    expect(spacingFields().map((field) => field.value)).toEqual(['0', '0']);
  });
});

describe('setting a spacing', () => {
  it('stores the gutter on the row', async () => {
    const { row } = await openWith([50, 50]);

    change(gutterField(), '20');

    expect(row.gutter).toBe(20);
    expect(gutterField().value).toBe('20');
  });

  it('stores the stack spacing on its step, and shows it', async () => {
    const { row } = await openWith([50, 50]);

    change(stackSpacingField(), '13');

    expect(row.stackSpacing).toBe(12);
    expect(stackSpacingField().value).toBe('12');
  });

  it('keeps the two apart', async () => {
    const { row } = await openWith([50, 50]);

    change(stackSpacingField(), '24');

    expect(row.stackSpacing).toBe(24);
    expect(row).not.toHaveProperty('gutter');
  });

  // The state does not change, so Vue has nothing to redraw: the field is put
  // back by hand, as a refused width is.
  test.each([
    ['past the maximum', String(MAX_GUTTER + 1)],
    ['negative', '-4'],
  ])(
    'puts a refused value %s back to what the row holds',
    async (_l, typed) => {
      const { row } = await openWith([50, 50]);
      change(gutterField(), '8');

      change(gutterField(), typed);

      expect(row.gutter).toBe(8);
      expect(gutterField().value).toBe('8');
    }
  );

  it('writes no key for a spacing set back to 0', async () => {
    const { modal, row } = await openWith([50, 50]);
    change(gutterField(), '20');
    change(stackSpacingField(), '8');

    change(gutterField(), '0');
    change(stackSpacingField(), '');

    expect(row).not.toHaveProperty('gutter');
    expect(row).not.toHaveProperty('stackSpacing');
    expect(serialiseState(modal.state)).not.toMatch(/gutter|stackSpacing/);
  });

  it('is refused on a row of one column', async () => {
    const { modal, row } = await openWith();

    expect(modal.setRowSpacing(row.id, 'gutter', 20)).toBe(false);
    expect(row).not.toHaveProperty('gutter');
  });
});

describe('a change of structure', () => {
  async function spaced() {
    const opened = await openWith([50, 50]);
    change(gutterField(), '20');
    change(stackSpacingField(), '12');
    return opened;
  }

  it('keeps the spacing of a row that still has several columns', async () => {
    const { modal, row } = await spaced();

    modal.setRowWidths(row.id, [33, 33, 34]);

    expect(row).toMatchObject({ gutter: 20, stackSpacing: 12 });
  });

  it('removes it from a row that goes down to one column, which stays flat', async () => {
    const { modal, row } = await spaced();

    modal.setRowWidths(row.id, [100]);
    await Vue.nextTick();

    expect(row).not.toHaveProperty('gutter');
    expect(row).not.toHaveProperty('stackSpacing');
    expect(isFlatComposition(modal.state)).toBe(true);
    expect(spacingFields()).toEqual([]);
  });

  it('starts again at 0 when the row gets its columns back', async () => {
    const { modal, row } = await spaced();
    modal.setRowWidths(row.id, [100]);

    modal.setRowWidths(row.id, [50, 50]);
    await Vue.nextTick();

    expect(spacingFields().map((field) => field.value)).toEqual(['0', '0']);
  });
});

describe('a duplicated row', () => {
  it('keeps the spacing of the row it copies', async () => {
    const { modal, row } = await openWith([50, 50]);
    change(gutterField(), '16');
    change(stackSpacingField(), '8');

    const copy = modal.duplicateRow(row.id);

    expect(copy).toMatchObject({ gutter: 16, stackSpacing: 8 });
    expect(copy.id).not.toBe(row.id);
  });
});
