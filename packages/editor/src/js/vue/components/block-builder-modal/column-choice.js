'use strict';

const {
  COLUMN_ROW_ATTRIBUTE,
  COLUMN_INDEX_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');
const { ACTIVE_COLUMN_CLASS } = require('./preview-document.js');

// Choosing a column in the preview: which column a click landed in, and the
// mark the chosen one carries (selection.js decides what is chosen).
//
// A Vue 2 mixin, like the preview surface that calls it: a click there that
// lands on no element asks `previewColumnFromEvent`, and every highlight pass
// ends with `applyColumnHighlight`.
//
// The component is expected to provide `rowById` and `chosenColumn`
// (selection.js) and `applySelectionHighlight` (preview-surface.js).

const ColumnChoiceMixin = {
  watch: {
    // A column chosen, or no longer: only the marks move, like the outline of
    // a selected element.
    chosenColumn() {
      this.applySelectionHighlight();
    },
  },
  methods: {
    /**
     * The column an event happened in, as `{ rowId, index }`, or null: the
     * preview's column chrome, looked up from the cell too, since the chrome
     * is only as tall as what it holds. A row that is nowhere in the
     * composition is not ours.
     *
     * @param {Event} event
     * @returns {{rowId: string, index: number}|null}
     */
    previewColumnFromEvent(event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return null;
      const selector = `[${COLUMN_ROW_ATTRIBUTE}]`;
      let chrome = target.closest(selector);
      if (!chrome) {
        const cell = target.closest('td');
        chrome = cell && cell.querySelector(selector);
      }
      if (!chrome) return null;
      const rowId = chrome.getAttribute(COLUMN_ROW_ATTRIBUTE);
      const index = Number(chrome.getAttribute(COLUMN_INDEX_ATTRIBUTE));
      if (!this.rowById(rowId) || !Number.isInteger(index)) return null;
      return { rowId, index };
    },

    /**
     * Marks the chosen column, while its row is selected, and no other.
     *
     * Compared attribute by attribute, like the selected element: the ids
     * come from stored state.
     *
     * @param {Document} doc the preview document
     */
    applyColumnHighlight(doc) {
      if (!doc || !doc.body) return;
      const chosen = this.chosenColumn;
      doc.body.querySelectorAll(`[${COLUMN_ROW_ATTRIBUTE}]`).forEach((node) => {
        const active =
          Boolean(chosen) &&
          node.getAttribute(COLUMN_ROW_ATTRIBUTE) === chosen.rowId &&
          Number(node.getAttribute(COLUMN_INDEX_ATTRIBUTE)) === chosen.index;
        node.classList.toggle(ACTIVE_COLUMN_CLASS, active);
      });
    },
  },
};

module.exports = { ColumnChoiceMixin };
