'use strict';

const {
  MAX_COLUMNS,
  MIN_COLUMN_WIDTH,
  FULL_WIDTH,
  newRowId,
} = require('../../../../../../shared/block-builder/composition.js');

// Rows: selecting one, and setting its structure.
//
// A Vue 2 mixin for the same reason as the element list: every one of these
// reads or writes the component's `state` and its selection, and a mixin keeps
// `this` meaning the component.
//
// The component is expected to provide: `state`, `selectedRowId`,
// `selectedElementId` and `vm`.

// The structures offered as one click each. They are nothing but widths — a
// row reached through a preset and the same row typed by hand are the same
// row, because a name beside the widths would be a second source of truth.
const PRESETS = [
  { key: 'full', widths: [FULL_WIDTH] },
  { key: 'halves', widths: [50, 50] },
  { key: 'two-thirds-left', widths: [66, 34] },
  { key: 'two-thirds-right', widths: [34, 66] },
  { key: 'thirds', widths: [33, 33, 34] },
  { key: 'quarters', widths: [25, 25, 25, 25] },
];

/**
 * Whether a list of widths is one a row may have.
 *
 * Refused rather than repaired: the panel is the one place a user sets these,
 * so anything outside the limits is a bug in the caller, and silently moving
 * the numbers would hide it. A stored value is a different matter and is
 * normalised on read (composition.js).
 *
 * @param {Array<number>} widths
 * @returns {boolean}
 */
function areUsableWidths(widths) {
  if (!Array.isArray(widths) || widths.length === 0) return false;
  if (widths.length > MAX_COLUMNS) return false;
  if (!widths.every((width) => Number.isFinite(width))) return false;
  if (widths.some((width) => width < MIN_COLUMN_WIDTH)) return false;
  return widths.reduce((sum, width) => sum + width, 0) === FULL_WIDTH;
}

const RowSettingsMixin = {
  computed: {
    presets() {
      return PRESETS;
    },

    selectedRow() {
      if (!this.selectedRowId) return null;
      return (
        (this.state.rows || []).find((row) => row.id === this.selectedRowId) ||
        null
      );
    },

    // What the panel shows: a row's structure, or an element's settings. One
    // of the two, never both, so the panel never has to choose.
    selectedRowWidths() {
      const row = this.selectedRow;
      return row ? row.columns.map((column) => column.width) : [];
    },
  },

  methods: {
    isPresetActive(preset) {
      const widths = this.selectedRowWidths;
      return (
        widths.length === preset.widths.length &&
        widths.every((width, index) => width === preset.widths[index])
      );
    },

    presetLabel(preset) {
      return this.vm.t(`block-builder-structure-${preset.key}`);
    },

    // The two selections are exclusive, and that is enforced here rather than
    // left to each caller: a panel showing a row's structure while an element
    // is also selected is how it starts showing the wrong thing.
    selectRow(id) {
      this.selectedRowId = id;
      this.selectedElementId = null;
    },

    selectElement(id) {
      this.selectedElementId = id;
      this.selectedRowId = null;
    },

    addRow() {
      const row = { id: newRowId(), columns: [{ width: FULL_WIDTH, elements: [] }] };
      this.state.rows.push(row);
      this.selectRow(row.id);
      this.scheduleRender();
      return row;
    },

    /**
     * Gives a row the structure these widths describe.
     *
     * The elements already placed are kept, always. When a structure loses a
     * column, its elements move to the last column that survives rather than
     * being dropped: losing a paragraph to a layout change is the kind of thing
     * a user never forgives and never reports precisely enough to reproduce.
     *
     * @param {string} rowId
     * @param {Array<number>} widths
     * @returns {boolean} whether the row changed
     */
    setRowWidths(rowId, widths) {
      const row = (this.state.rows || []).find((entry) => entry.id === rowId);
      if (!row || !areUsableWidths(widths)) return false;

      const kept = row.columns.slice(0, widths.length);
      // Fewer columns than before: everything past the new last one is folded
      // into it, in order.
      row.columns.slice(widths.length).forEach((column) => {
        kept[kept.length - 1].elements.push(...column.elements);
      });

      row.columns = widths.map((width, index) => ({
        width,
        elements: kept[index] ? kept[index].elements : [],
      }));

      this.scheduleRender();
      return true;
    },

    applyPreset(preset) {
      if (!this.selectedRowId) return;
      this.setRowWidths(this.selectedRowId, preset.widths);
    },

    /**
     * Sets one column's width, taking the difference from the next column.
     *
     * The next one rather than spreading it: a user dragging a boundary is
     * moving THAT boundary, and redistributing across every column would move
     * the ones they were not touching.
     *
     * @param {number} index the column whose width is being set
     * @param {number} width
     */
    setColumnWidth(index, width) {
      const widths = this.selectedRowWidths.slice();
      if (index < 0 || index >= widths.length - 1) return;

      const rounded = Math.round(width);
      const pair = widths[index] + widths[index + 1];
      if (
        rounded < MIN_COLUMN_WIDTH ||
        pair - rounded < MIN_COLUMN_WIDTH
      ) {
        return;
      }

      widths[index] = rounded;
      widths[index + 1] = pair - rounded;
      this.setRowWidths(this.selectedRowId, widths);
    },

    canAddColumn() {
      return this.selectedRowWidths.length < MAX_COLUMNS;
    },
  },
};

module.exports = {
  RowSettingsMixin,
  PRESETS,
  areUsableWidths,
  MAX_COLUMNS,
  MIN_COLUMN_WIDTH,
};
