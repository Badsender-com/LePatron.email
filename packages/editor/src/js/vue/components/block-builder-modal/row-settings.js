'use strict';

const {
  MIN_COLUMN_WIDTH,
  MAX_ROWS,
  elementsOf,
  FULL_WIDTH,
  singleColumnRows,
  canAddRow,
  areUsableWidths,
} = require('../../../../../../shared/block-builder/composition.js');
const { ListboxMixin } = require('./listbox.js');

// Rows: the list of them, and the structure of the selected one.
//
// A Vue 2 mixin for the same reason as the element list: every one of these
// reads or writes the component's `state` and its selection, and a mixin keeps
// `this` meaning the component.
//
// The component is expected to provide: `state`, `vm`, and
//   - from selection.js: `selectedRowId`, `selectedRow`, `selectedRowIndex`,
//     `selectRow`, `rowById`;
//   - from element-list.js: `labelFor`, so a row is named by its first element
//     in the words the element list uses;
//   - from row-actions.js: `moveRowByKey`, which the row list's keyboard hands
//     Alt+arrow to before walking the list.
// No other mixin calls into this one.

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

// The strings the panel builds with variables, rather than through the
// template: the translations test reads plain keys off the template, and these
// it would miss.
const ROW_LABEL_KEYS = [
  'block-builder-row-label',
  'block-builder-row-label-one',
  'block-builder-row-label-empty',
  'block-builder-row-label-empty-one',
  'block-builder-column-width',
  'block-builder-elements-folded',
  'block-builder-elements-folded-one',
];

const sameWidths = (a, b) =>
  a.length === b.length && a.every((width, index) => width === b[index]);

const RowSettingsMixin = {
  mixins: [ListboxMixin],
  data: () => ({
    // Where the elements of the columns a structure change removed went:
    // `{ rowId, count, column }`, or null. Said once, under the structure, and
    // gone at the next change — a user who changes the structure again has
    // moved on from the last one.
    foldedNotice: null,
    minColumnWidth: MIN_COLUMN_WIDTH,
    fullWidth: FULL_WIDTH,
  }),

  computed: {
    presets() {
      return PRESETS;
    },

    // The bound a stored composition is read within (composition.js): a row
    // past it would be accepted here and refused on every save after.
    rowLimitReached() {
      return !canAddRow(this.state);
    },

    maxRows() {
      return MAX_ROWS;
    },

    // What the panel shows: a row's structure, or an element's settings. One
    // of the two, never both, so the panel never has to choose.
    selectedRowWidths() {
      const row = this.selectedRow;
      return row ? row.columns.map((column) => column.width) : [];
    },

    foldedMessage() {
      const notice = this.foldedNotice;
      if (!notice || notice.rowId !== this.selectedRowId) return '';
      const key =
        notice.count === 1
          ? 'block-builder-elements-folded-one'
          : 'block-builder-elements-folded';
      return this.vm.t(key, { count: notice.count, column: notice.column });
    },
  },

  watch: {
    // Another row, or none: the notice was about the row the user left. Only
    // then — watchers run after the tick, so a row selected and restructured in
    // the same tick would otherwise lose its notice on arrival.
    selectedRowId(id) {
      if (this.foldedNotice && this.foldedNotice.rowId !== id) {
        this.foldedNotice = null;
      }
    },
  },

  methods: {
    isPresetActive(preset) {
      return sameWidths(this.selectedRowWidths, preset.widths);
    },

    presetLabel(preset) {
      return this.vm.t(`block-builder-structure-${preset.key}`);
    },

    // "Row 2 · 3 columns — Text — Hello": the position, the structure in
    // words a screen reader can say, and the row's first element as the
    // element list names it — or "empty". Position and structure alone say
    // nothing of what a row holds: rows of the same structure read alike,
    // and after a move or a duplication the list reads exactly as before.
    rowLabel(row, index) {
      const count = row.columns.length;
      const [first] = elementsOf([row]);
      const key = [
        'block-builder-row-label',
        first ? '' : '-empty',
        count === 1 ? '-one' : '',
      ].join('');
      // `vm.t` substitutes through String#replace, which reads `$&` and its
      // kind in the replacement: doubled, the user's own `$` shows as typed.
      const label = first ? this.labelFor(first).replace(/\$/g, '$$$$') : '';
      return this.vm.t(key, { n: index + 1, count, first: label });
    },

    columnWidthLabel(index) {
      return this.vm.t('block-builder-column-width', { n: index + 1 });
    },

    rowTabIndex(index) {
      return this.listboxTabIndex(index, this.selectedRowIndex);
    },

    // Alt with an arrow moves the row (row-actions.js); a plain arrow walks
    // the list, as it does in the element list.
    onRowKeydown(event, index) {
      if (this.moveRowByKey(event, index)) return;
      const rows = this.state.rows || [];
      this.onListboxKeydown(event, index, {
        length: rows.length,
        select: (at) => this.selectRow(rows[at].id),
        options: '.bb-modal__rows [role="option"]',
      });
    },

    // Selected on arrival, so the palette fills it: the active column is the
    // selected row's first one (selection.js). Nothing to render by hand: the
    // preview's watcher shows the new row, as an empty column to drop into.
    addRow() {
      if (!canAddRow(this.state)) return null;
      const [row] = singleColumnRows();
      this.state.rows.push(row);
      this.selectRow(row.id);
      return row;
    },

    /**
     * Gives a row the structure these widths describe.
     *
     * The elements already placed are kept, always. When a structure loses a
     * column, its elements move to the last column that survives rather than
     * being dropped: losing a paragraph to a layout change is the kind of thing
     * a user never forgives and never reports precisely enough to reproduce.
     * And the panel says where they went (`foldedNotice`), or the user would
     * look for them in the column that is gone.
     *
     * No render is asked for: the preview watches its markup, and a structure
     * that did not change the markup has nothing to redraw.
     *
     * @param {string} rowId
     * @param {Array<number>} widths
     * @returns {boolean} whether the row changed
     */
    setRowWidths(rowId, widths) {
      const row = this.rowById(rowId);
      // Refused rather than repaired: the panel is the one place a user sets
      // widths, so anything outside the limits is a bug in the caller, and
      // silently moving the numbers would hide it. A stored value is a
      // different matter and is normalised on read (composition.js).
      if (!row || !areUsableWidths(widths)) return false;
      // The preset already active, clicked again.
      if (sameWidths(row.columns.map((column) => column.width), widths)) {
        return false;
      }

      const kept = row.columns.slice(0, widths.length);
      // Fewer columns than before: everything past the new last one is folded
      // into it, in order.
      const folded = row.columns
        .slice(widths.length)
        .flatMap((column) => column.elements);
      kept[kept.length - 1].elements.push(...folded);

      // Spread, so whatever else a column holds survives a change of width.
      row.columns = widths.map((width, index) =>
        kept[index] ? { ...kept[index], width } : { width, elements: [] }
      );

      this.foldedNotice = folded.length
        ? { rowId, count: folded.length, column: widths.length }
        : null;
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
     * @returns {boolean} whether the row changed
     */
    setColumnWidth(index, width) {
      const widths = this.selectedRowWidths.slice();
      if (index < 0 || index >= widths.length - 1) return false;

      const rounded = Math.round(width);
      const pair = widths[index] + widths[index + 1];
      if (rounded < MIN_COLUMN_WIDTH || pair - rounded < MIN_COLUMN_WIDTH) {
        return false;
      }

      widths[index] = rounded;
      widths[index + 1] = pair - rounded;
      return this.setRowWidths(this.selectedRowId, widths);
    },

    // The field, once its value has been offered to the row. Put back to what
    // the row holds whatever happened: a refused width leaves the state as it
    // was, so Vue sees nothing to redraw and the field would go on showing a
    // number the row does not have. An accepted one may have been rounded.
    onColumnWidthChange(event, index) {
      this.setColumnWidth(index, Number(event.target.value));
      event.target.value = this.selectedRowWidths[index];
    },

  },
};

module.exports = {
  RowSettingsMixin,
  PRESETS,
  ROW_LABEL_KEYS,
};
