'use strict';

const {
  ELEMENTS,
} = require('../../../../../../shared/block-builder/elements/index.js');
const {
  newElementId,
} = require('../../../../../../shared/block-builder/state.js');
const {
  singleColumnRows,
  columnAt,
  elementsOfState,
} = require('../../../../../../shared/block-builder/composition.js');
const {
  moveInList,
} = require('../../../../../../shared/block-builder/move-in-list.js');
const {
  isBlankElement,
} = require('../../../../../../shared/block-builder/element-markup.js');
const { elementLabel } = require('./element-label.js');
const { ListboxMixin } = require('./listbox.js');

// The element list: what can be added, and what has been — adding, selecting,
// reordering and removing.
//
// A Vue 2 mixin for the same reason as the preview surface (preview-surface.js):
// every one of these reads or writes the component's `state` and its selection,
// and a mixin keeps `this` meaning the component.
//
// It works on the ACTIVE column, the one the selection designates (see
// selection.js): what the list shows, what the arrows move within, what the
// palette adds to.
//
// The component is expected to provide: `state`, `columnElements`,
// `selectedElementId`, `selectElement`, `locateElement`, `activeColumn`,
// `activeColumnPlace` (selection.js) and `vm`.

const PALETTE = [
  { type: 'text', labelKey: 'block-builder-element-text' },
  { type: 'image', labelKey: 'block-builder-element-image' },
  { type: 'button', labelKey: 'block-builder-element-button' },
  { type: 'divider', labelKey: 'block-builder-element-divider' },
  { type: 'spacer', labelKey: 'block-builder-element-spacer' },
];

const defaultsFor = (type) => {
  const definition = ELEMENTS.find((element) => element.type === type);
  return definition ? { ...definition.defaults } : {};
};

// The list's own label, built in script for the variables it carries.
const ELEMENT_LIST_LABEL_KEYS = [
  'block-builder-elements-column',
  'block-builder-blank-elements',
  'block-builder-blank-elements-one',
];

const columnCount = (rows) =>
  (rows || []).reduce((count, row) => count + row.columns.length, 0);

const ElementListMixin = {
  mixins: [ListboxMixin],
  data: () => ({ palette: PALETTE }),
  computed: {
    listLabelId() {
      return `bb-elements-${this._uid}`;
    },

    columnTitleId() {
      return `bb-elements-column-${this._uid}`;
    },

    // Which column the list shows — "Row 1 · Column 2" — once the block has
    // more than one to show. Nothing for a block of a single column, where
    // there is no other to mistake it for.
    columnTitle() {
      const place = this.activeColumnPlace;
      if (!place || columnCount(this.state.rows) < 2) return '';
      return this.vm.t('block-builder-elements-column', place);
    },

    // How many elements will not be sent, said under the preview: a block of
    // starters looks done there, and applies as nothing.
    blankNotice() {
      const count = elementsOfState(this.state).filter(isBlankElement).length;
      if (count === 0) return '';
      return count === 1
        ? this.vm.t('block-builder-blank-elements-one')
        : this.vm.t('block-builder-blank-elements', { count });
    },

    // The list is named by its section and, when there is one, its column.
    listLabelledBy() {
      return this.columnTitle
        ? `${this.listLabelId} ${this.columnTitleId}`
        : this.listLabelId;
    },
  },
  methods: {
    // `suffix` follows the type's name, before what tells the element apart:
    // the row list puts there how many more elements the row holds.
    labelFor(element, suffix = '') {
      const entry = PALETTE.find((item) => item.type === element.type);
      const name = entry ? this.vm.t(entry.labelKey) : element.type;
      return elementLabel(
        element,
        `${name}${suffix}`,
        this.vm.t('block-builder-element-blank')
      );
    },

    // Clicking a palette entry adds right after the selected element, in its
    // column; with a row or nothing selected, at the end of the active column
    // — a row's first column, or the first one of the block. It stays
    // alongside the drag: it is the quick path, it is what a keyboard
    // reaches, and it is the fallback when a drag is dropped somewhere that
    // refuses it.
    addElement(type) {
      const place = this.locateElement(this.selectedElementId);
      return this.insertElement(
        type,
        place
          ? {
              rowId: place.row.id,
              columnIndex: place.row.columns.indexOf(place.column),
              index: place.index + 1,
            }
          : null
      );
    },

    // A palette entry is a `div role="button"`, not a <button>: Firefox does
    // not start a native drag from a <button draggable>. So it does by hand
    // what a <button> does for free — Enter on keydown, Space on keyup, and
    // Space's keydown cancelled so the column does not scroll under it.
    onPaletteKeydown(event, type) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addElement(type);
      } else if (event.key === ' ') {
        event.preventDefault();
      }
    },

    onPaletteKeyup(event, type) {
      if (event.key !== ' ') return;
      event.preventDefault();
      this.addElement(type);
    },

    /**
     * Adds a new element of `type` into a column, at a position inside it.
     *
     * The one insertion. The palette's click reaches it with the place after
     * the selection (addElement), a drop with the place its line shows. A
     * target that names no column of the composition — no target at all, as
     * when a drop lands on a preview with no column to aim at, after the last
     * row was deleted — lands at the end of the active column instead.
     *
     * @param {string} type
     * @param {{rowId: string, columnIndex: number, index: number}|null} [target]
     * @returns {Object|null} the element, or null for a type the palette does
     *   not offer
     */
    insertElement(type, target) {
      if (!PALETTE.some((item) => item.type === type)) return null;

      // A composition left without any row still takes an element: it gets
      // the row a new block starts with, rather than an element spliced into
      // a list that belongs to nothing.
      if (!this.activeColumn) this.state.rows.push(...singleColumnRows());
      const aimed = columnAt(this.state, target);
      const { elements } = aimed || this.activeColumn;
      const wanted =
        aimed && Number.isInteger(target.index) ? target.index : elements.length;

      // Blank, as its defaults have it. What the preview shows in a blank
      // element is a starter drawn there and nowhere else (see STARTERS in
      // element-settings.js): nothing the user did not type reaches the state.
      const element = { id: newElementId(), type, ...defaultsFor(type) };
      elements.splice(Math.max(0, Math.min(wanted, elements.length)), 0, element);
      // Selected on arrival, so the settings panel is already on it — dropping
      // and editing are one gesture, not two. Rendered by the preview's
      // watcher, like every other change.
      this.selectElement(element.id);
      return element;
    },

    removeSelected() {
      const index = this.indexOfSelected();
      if (index === -1) return;
      // Held before the splice: the active column is derived from the
      // selection, and the selected element is the one going — read again
      // after, it would be another column.
      const elements = this.columnElements;
      elements.splice(index, 1);
      const next = elements[index] || elements[index - 1];
      this.selectElement(next ? next.id : null);
    },

    // The arrows, through the drag's own move so the splice exists once.
    // moveElementTo takes a drop position, counted with the element still in
    // place: one row down is past the next row, two positions on.
    move(offset) {
      if (!this.canMove(offset)) return;
      const target = this.indexOfSelected() + offset;
      const position = offset > 0 ? target + 1 : target;
      this.moveElementTo(this.selectedElementId, position);
    },

    /**
     * Moves an element to a drop position — for the reorder drag, and for
     * the arrows through `move`.
     *
     * `index` counts rows as they are laid out NOW, with the dragged element
     * still among them. Taking it out first shifts everything after it up by
     * one, so a target past its old position has to come down by one — the
     * classic off-by-one of every reorder, and the reason dropping an element
     * just below itself would otherwise move it one row too far.
     *
     * The moved element ends up selected, so the settings panel stays on it.
     */
    moveElementTo(id, index) {
      // Held for the whole move: the active column is derived from where the
      // selected element is, and between the two splices it is nowhere.
      const elements = this.columnElements;
      const from = elements.findIndex((element) => element.id === id);
      if (from === -1) return;

      this.selectElement(id);
      moveInList(elements, from, index);
    },

    /**
     * Moves an element to a column, at a position inside it.
     *
     * The operation, not the gesture: the drag into a column calls it, with
     * the target its drop line shows. A structure change does not need it —
     * setRowWidths folds the elements of a column that disappears itself.
     *
     * The element keeps its identity and its settings: it is moved, never
     * recreated.
     *
     * @param {string} id
     * @param {{rowId: string, columnIndex: number, index: number}} target
     * @returns {boolean} whether it moved
     */
    moveElement(id, target) {
      const from = this.locateElement(id);
      const to = columnAt(this.state, target);
      if (!from || !to) return false;

      // Within its own column, a drop position counts the element still in
      // place (move-in-list.js). Across columns nothing moves underneath.
      if (from.column === to) {
        moveInList(to.elements, from.index, target.index);
      } else {
        const [element] = from.column.elements.splice(from.index, 1);
        const at = Math.max(0, Math.min(target.index, to.elements.length));
        to.elements.splice(at, 0, element);
      }

      // Rendered by the preview's watcher, like every other change.
      this.selectElement(id);
      return true;
    },

    // Whether the selected element can move by `offset`, so the buttons are
    // disabled at the ends of the list rather than silently doing nothing.
    canMove(offset) {
      const index = this.indexOfSelected();
      const target = index + offset;
      return index !== -1 && target >= 0 && target < this.columnElements.length;
    },

    // The list is a listbox with a roving tabindex: one Tab stop — the selected
    // option, or the first — and the arrows to move within it. The motif is
    // shared with the row list (listbox.js).
    optionTabIndex(index) {
      return this.listboxTabIndex(index, this.indexOfSelected());
    },

    onOptionKeydown(event, index) {
      this.onListboxKeydown(event, index, {
        length: this.columnElements.length,
        select: (at) => this.selectElement(this.columnElements[at].id),
        options: '.bb-modal__list [role="option"]',
      });
    },

    indexOfSelected() {
      return this.columnElements.findIndex(
        (element) => element.id === this.selectedElementId
      );
    },
  },
};

module.exports = { ElementListMixin, PALETTE, ELEMENT_LIST_LABEL_KEYS };
