'use strict';

const {
  MAX_ROWS,
  elementsOf,
  singleColumnRows,
  canAddRow,
} = require('../../../../../../shared/block-builder/composition.js');
const {
  FULL_WIDTH,
  areUsableWidths,
  areLegacyWidths,
  widthsFromProportions,
  rowLayout,
} = require('../../../../../../shared/block-builder/row-layout.js');
const {
  GUTTERS_KEY,
  normaliseGutters,
  gutterTotal,
} = require('../../../../../../shared/block-builder/row-spacing.js');
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
//     Alt+arrow to before walking the list;
//   - from row-spacing-settings.js: `clearRowSpacing`, for a row that goes
//     down to one column.
// The widths of the selected row are set on the bar, row-layout-bar.js.
// No other mixin calls into this one.

// The structures offered as one click each: how many columns, and in what
// proportions of the room the gutters leave. Nothing but widths once applied —
// a row reached through a preset and the same row set on the bar are the same
// row, because a name beside the widths would be a second source of truth.
const PRESETS = [
  { key: 'full', widths: [100] },
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
  'block-builder-elements-folded',
  'block-builder-elements-folded-one',
  'block-builder-row-limit',
  'block-builder-row-limit-reached',
  'block-builder-row-more',
];

const sameWidths = (a, b) =>
  a.length === b.length && a.every((width, index) => width === b[index]);

/**
 * A row's layout once given a structure: the proportions in px of what the
 * gutters leave, the row keeping the gutters it had between the columns that
 * remain, and 0 for a new one.
 *
 * @param {Object} row
 * @param {Array<number>} proportions in percent, adding up to 100
 * @returns {{widths: Array<number>, gutters: Array<number>}}
 */
function layoutFor(row, proportions) {
  const gutters = normaliseGutters(row[GUTTERS_KEY], proportions.length);
  return {
    widths: widthsFromProportions(
      proportions,
      FULL_WIDTH - gutterTotal(gutters)
    ),
    gutters,
  };
}

/** The layout a row renders with now. */
const currentLayout = (row) =>
  rowLayout(
    row.columns.map((column) => column.width),
    row[GUTTERS_KEY]
  );

const RowSettingsMixin = {
  mixins: [ListboxMixin],
  data: () => ({
    // Where the elements of the columns a structure change removed went:
    // `{ rowId, count, column }`, or null. Said once, under the structure, and
    // gone at the next change — a user who changes the structure again has
    // moved on from the last one.
    foldedNotice: null,
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

    // At the limit, the greyed-out button says why itself: a tooltip is all a
    // pointer gets, and a keyboard or a touch screen never shows it.
    addRowLabel() {
      return this.rowLimitReached
        ? this.vm.t('block-builder-row-limit-reached', { max: MAX_ROWS })
        : `+ ${this.vm.t('block-builder-add-row')}`;
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
    // Active when the row is what applying it would make of the row now.
    isPresetActive(preset) {
      const row = this.selectedRow;
      if (!row || row.columns.length !== preset.widths.length) return false;
      return sameWidths(
        currentLayout(row).widths,
        layoutFor(row, preset.widths).widths
      );
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
      // The elements after the first are counted, or a row of a text, an
      // image and a button reads as a text alone — right after the first's
      // type, before its words, so a name cut at two lines still says it.
      const others = elementsOf([row]).length - 1;
      const more =
        others > 0 ? ` ${this.vm.t('block-builder-row-more', { count: others })}` : '';
      // `vm.t` substitutes through String#replace, which reads `$&` and its
      // kind in the replacement: doubled, the user's own `$` shows as typed.
      const label = first
        ? this.labelFor(first, more).replace(/\$/g, '$$$$')
        : '';
      return this.vm.t(key, { n: index + 1, count, first: label });
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
     * Gives a row the structure these proportions describe, in px of what its
     * gutters leave: the gutters between the columns that remain are kept.
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
     * @param {Array<number>} proportions in percent, adding up to 100, as a
     *   preset gives them
     * @returns {boolean} whether the row changed
     */
    setRowWidths(rowId, proportions) {
      const row = this.rowById(rowId);
      // Refused rather than repaired: the presets are the one place a
      // structure comes from, so anything outside the limits is a bug in the
      // caller, and silently moving the numbers would hide it. A stored value
      // is a different matter and is normalised on read (composition.js).
      if (!row || !areLegacyWidths(proportions)) return false;
      const { widths, gutters } = layoutFor(row, proportions);
      if (!areUsableWidths(widths, gutters)) return false;
      // The preset already active, clicked again.
      if (
        row.columns.length === widths.length &&
        sameWidths(currentLayout(row).widths, widths)
      ) {
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
      // The space between columns goes with the last of them: a row of one
      // column keeps no setting, and stays flat (row-spacing-settings.js).
      // Otherwise the row keeps its gutters, cut to its new intervals.
      if (widths.length < 2) this.clearRowSpacing(row);
      else if (gutterTotal(gutters) > 0) this.$set(row, GUTTERS_KEY, gutters);
      else if (GUTTERS_KEY in row) this.$delete(row, GUTTERS_KEY);

      this.foldedNotice = folded.length
        ? { rowId, count: folded.length, column: widths.length }
        : null;
      return true;
    },

    applyPreset(preset) {
      if (!this.selectedRowId) return;
      this.setRowWidths(this.selectedRowId, preset.widths);
    },
  },
};

module.exports = {
  RowSettingsMixin,
  PRESETS,
  ROW_LABEL_KEYS,
};
