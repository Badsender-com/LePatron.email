'use strict';

const {
  GUTTER_KEY,
  STACK_SPACING_KEY,
  SPACING_KEYS,
  MAX_GUTTER,
  MAX_STACK_SPACING,
  STACK_SPACING_STEP,
  normaliseGutter,
  normaliseStackSpacing,
} = require('../../../../../../shared/block-builder/row-spacing.js');

// The space between the columns of the selected row: the desktop gutter and
// the mobile stack spacing, two fields of the structure panel (ADR 0025, "Row
// settings"). The rendering is the generator's (row-markup.js); this only sets
// the values on the row.
//
// A Vue 2 mixin, like the row settings beside it (row-settings.js): it reads
// and writes the component's `state`. The component is expected to provide,
// from selection.js, `selectedRow`, `selectedRowId` and `rowById`.
//
// Called from outside: `clearRowSpacing`, by row-settings.js when a row goes
// down to one column.

// What each setting may be, and how a value the panel accepts is stored: the
// same normalisation a stored row is read with (composition.js), so what the
// modal renders is what the server will rebuild.
const SETTINGS = {
  [GUTTER_KEY]: { max: MAX_GUTTER, normalise: normaliseGutter },
  [STACK_SPACING_KEY]: {
    max: MAX_STACK_SPACING,
    normalise: normaliseStackSpacing,
  },
};

// Built with a variable, so the translations test cannot read it off the
// template.
const ROW_SPACING_LABEL_KEYS = ['block-builder-stack-spacing-hint'];

const RowSpacingMixin = {
  data: () => ({
    gutterKey: GUTTER_KEY,
    stackSpacingKey: STACK_SPACING_KEY,
    maxGutter: MAX_GUTTER,
    maxStackSpacing: MAX_STACK_SPACING,
    stackSpacingStep: STACK_SPACING_STEP,
  }),

  computed: {
    // Only a row of several columns has a space between them to set.
    selectedRowSpaces() {
      const row = this.selectedRow;
      return Boolean(row && row.columns.length > 1);
    },

    stackSpacingHintId() {
      return `bb-stack-spacing-hint-${this._uid}`;
    },

    stackSpacingHint() {
      return this.vm.t('block-builder-stack-spacing-hint', {
        step: STACK_SPACING_STEP,
      });
    },
  },

  methods: {
    /**
     * What the selected row holds for a setting, as it renders: 0 when unset.
     *
     * @param {string} key GUTTER_KEY or STACK_SPACING_KEY
     * @returns {number}
     */
    selectedRowSpacing(key) {
      const row = this.selectedRow;
      return row ? SETTINGS[key].normalise(row[key]) : 0;
    },

    /**
     * Sets one spacing of a row. A value of 0 removes the key, so a row at the
     * defaults is stored exactly as before the settings existed.
     *
     * Refused rather than clamped: a number past the bounds is a typing
     * mistake, and silently storing the maximum would hide it. Accepted values
     * are rounded, the stack spacing to its step.
     *
     * @param {string} rowId
     * @param {string} key GUTTER_KEY or STACK_SPACING_KEY
     * @param {number} value in px
     * @returns {boolean} whether the row changed
     */
    setRowSpacing(rowId, key, value) {
      const row = this.rowById(rowId);
      const setting = SETTINGS[key];
      if (!row || !setting || row.columns.length < 2) return false;
      if (!Number.isFinite(value) || value < 0 || value > setting.max) {
        return false;
      }

      const next = setting.normalise(value);
      if (next === 0) {
        if (!(key in row)) return false;
        this.$delete(row, key);
        return true;
      }
      if (row[key] === next) return false;
      this.$set(row, key, next);
      return true;
    },

    // The field, once its value has been offered to the row: put back to what
    // the row holds whatever happened, as for a column's width
    // (onColumnWidthChange). A refused value leaves the state as it was, so
    // Vue would not redraw the field; an accepted one may have been rounded.
    // An emptied field means no space.
    onRowSpacingChange(event, key) {
      const typed = event.target.value.trim();
      this.setRowSpacing(
        this.selectedRowId,
        key,
        typed === '' ? 0 : Number(typed)
      );
      event.target.value = this.selectedRowSpacing(key);
    },

    /**
     * Removes a row's spacing settings: a row of one column has no space
     * between columns, and keeps none, so it stays flat.
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

module.exports = { RowSpacingMixin, ROW_SPACING_LABEL_KEYS };
