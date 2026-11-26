'use strict';

const {
  STACK_SPACING_KEY,
  SPACING_KEYS,
  MAX_STACK_SPACING,
  normaliseStackSpacing,
} = require('../../../../../../shared/block-builder/row-spacing.js');

// The stack spacing of the selected row: the space between its columns once
// they stack on a phone, a field of the structure panel (ADR 0025, "Row
// layout"). The gutters, the desktop half, are set on the bar
// (row-layout-bar.js). The rendering is the generator's (row-markup.js); this
// only sets the value on the row.
//
// A Vue 2 mixin, like the row settings beside it (row-settings.js): it reads
// and writes the component's `state`. The component is expected to provide,
// from selection.js, `selectedRow`, `selectedRowId` and `rowById`.
//
// Called from outside: `clearRowSpacing`, by row-settings.js when a row goes
// down to one column.

/**
 * What a number field holds, as a number, or null when the browser could not
 * read what was typed (`20px` in a number field): then the field holds an
 * empty string, which is not the same as a field the user emptied.
 *
 * @param {HTMLInputElement} input
 * @returns {number|null} an emptied field reads as 0
 */
function typedNumber(input) {
  if (input.validity && input.validity.badInput) return null;
  const typed = input.value.trim();
  return typed === '' ? 0 : Number(typed);
}

const RowSpacingMixin = {
  data: () => ({ maxStackSpacing: MAX_STACK_SPACING }),

  computed: {
    // Only a row of several columns has a space between them to set.
    selectedRowSpaces() {
      const row = this.selectedRow;
      return Boolean(row && row.columns.length > 1);
    },

    // What the selected row renders with: 0 when unset.
    selectedRowStackSpacing() {
      const row = this.selectedRow;
      return row ? normaliseStackSpacing(row[STACK_SPACING_KEY]) : 0;
    },

    stackSpacingLabelId() {
      return `bb-stack-spacing-label-${this._uid}`;
    },
  },

  methods: {
    /**
     * Sets the stack spacing of a row. A value of 0 removes the key, so a row
     * at the defaults is stored exactly as before the setting existed.
     *
     * Refused rather than clamped: a number past the bounds is a typing
     * mistake, and silently storing the maximum would hide it. An accepted
     * value is made a whole px, as a stored one is read.
     *
     * @param {string} rowId
     * @param {number} value in px
     * @returns {boolean} whether the row changed
     */
    setRowStackSpacing(rowId, value) {
      const row = this.rowById(rowId);
      if (!row || row.columns.length < 2) return false;
      if (!Number.isFinite(value) || value < 0 || value > MAX_STACK_SPACING) {
        return false;
      }

      const next = normaliseStackSpacing(value);
      if (next === 0) {
        if (!(STACK_SPACING_KEY in row)) return false;
        this.$delete(row, STACK_SPACING_KEY);
        return true;
      }
      if (row[STACK_SPACING_KEY] === next) return false;
      this.$set(row, STACK_SPACING_KEY, next);
      return true;
    },

    // The field, once its value has been offered to the row: put back to what
    // the row holds whatever happened. A refused value, or one the browser
    // could not read, leaves the state as it was, so Vue would not redraw the
    // field; an accepted one may have been rounded.
    onStackSpacingChange(event) {
      const value = typedNumber(event.target);
      if (value !== null) this.setRowStackSpacing(this.selectedRowId, value);
      event.target.value = this.selectedRowStackSpacing;
    },

    /**
     * Removes a row's spacing settings, gutters included: a row of one column
     * has no space between columns, and keeps none, so it stays flat.
     *
     * @param {Object} row
     */
    clearRowSpacing(row) {
      SPACING_KEYS.forEach((key) => {
        if (key in row) this.$delete(row, key);
      });
    },
  },
};

module.exports = { RowSpacingMixin, typedNumber };
