'use strict';

const {
  ELEMENTS,
} = require('../../../../../../shared/block-builder/elements/index.js');
const {
  newElementId,
} = require('../../../../../../shared/block-builder/state.js');

// The element list: what can be added, and what has been — adding, selecting,
// reordering and removing.
//
// A Vue 2 mixin for the same reason as the preview surface (preview-surface.js):
// every one of these reads or writes the component's `state` and `selectedId`,
// and a mixin keeps `this` meaning the component.
//
// The component is expected to provide: `state`, `selectedId` and `vm`.

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

// A text element's words as a reader sees them: tags dropped and character
// references decoded — TinyMCE writes `&nbsp;`, which showed as such in the
// list. Parsed in an inert document, which runs and loads nothing.
function plainTextOf(html) {
  const text =
    typeof DOMParser === 'undefined'
      ? html.replace(/<[^>]*>/g, '')
      : new DOMParser().parseFromString(html, 'text/html').body.textContent;
  return (text || '').replace(/\s+/g, ' ').trim();
}

const ElementListMixin = {
  data: () => ({ palette: PALETTE }),
  computed: {
    listLabelId() {
      return `bb-elements-${this._uid}`;
    },
  },
  methods: {
    labelFor(element) {
      const entry = PALETTE.find((item) => item.type === element.type);
      const name = entry ? this.vm.t(entry.labelKey) : element.type;
      if (element.type === 'text' && element.content) {
        // The first words, so a list of five texts is still readable.
        const plain = plainTextOf(element.content);
        if (plain) return `${name} — ${plain.slice(0, 28)}`;
      }
      if (element.type === 'button' && element.label) {
        return `${name} — ${element.label.slice(0, 28)}`;
      }
      return name;
    },

    // Clicking a palette entry appends. It stays alongside the drag: it is the
    // quick path, it is what a keyboard reaches, and it is the fallback when a
    // drag is dropped somewhere that refuses it.
    addElement(type) {
      this.insertElement(type, this.state.elements.length);
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

    insertElement(type, index) {
      if (!PALETTE.some((item) => item.type === type)) return null;

      // Blank, as its defaults have it. What the preview shows in a blank
      // element is a starter drawn there and nowhere else (see STARTERS in
      // element-settings.js): nothing the user did not type reaches the state.
      const element = { id: newElementId(), type, ...defaultsFor(type) };
      const at = Math.max(0, Math.min(index, this.state.elements.length));
      this.state.elements.splice(at, 0, element);
      // Selected on arrival, so the settings panel is already on it — dropping
      // and editing are one gesture, not two.
      this.selectedId = element.id;
      return element;
    },

    removeSelected() {
      const index = this.indexOfSelected();
      if (index === -1) return;
      this.state.elements.splice(index, 1);
      const next = this.state.elements[index] || this.state.elements[index - 1];
      this.selectedId = next ? next.id : null;
    },

    // The arrows, through the drag's own move so the splice exists once.
    // moveElementTo takes a drop position, counted with the element still in
    // place: one row down is past the next row, two positions on.
    move(offset) {
      if (!this.canMove(offset)) return;
      const target = this.indexOfSelected() + offset;
      const position = offset > 0 ? target + 1 : target;
      this.moveElementTo(this.selectedId, position);
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
      const from = this.state.elements.findIndex(
        (element) => element.id === id
      );
      if (from === -1) return;

      this.selectedId = id;
      const to = index > from ? index - 1 : index;
      if (to === from) return;

      const [element] = this.state.elements.splice(from, 1);
      this.state.elements.splice(to, 0, element);
    },

    // Whether the selected element can move by `offset`, so the buttons are
    // disabled at the ends of the list rather than silently doing nothing.
    canMove(offset) {
      const index = this.indexOfSelected();
      const target = index + offset;
      return index !== -1 && target >= 0 && target < this.state.elements.length;
    },

    // The list is a listbox with a roving tabindex: one Tab stop — the selected
    // option, or the first — and the arrows to move within it.
    optionTabIndex(index) {
      const selected = this.indexOfSelected();
      return index === (selected === -1 ? 0 : selected) ? 0 : -1;
    },

    onOptionKeydown(event, index) {
      const { key } = event;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        this.selectedId = this.state.elements[index].id;
        return;
      }
      if (key !== 'ArrowDown' && key !== 'ArrowUp') return;

      event.preventDefault();
      const next = index + (key === 'ArrowDown' ? 1 : -1);
      if (next < 0 || next >= this.state.elements.length) return;
      this.selectedId = this.state.elements[next].id;
      // After the render, which moves the tabindex onto the new option.
      this.$nextTick(() => {
        const options = this.$el.querySelectorAll('[role="option"]');
        if (options[next]) options[next].focus();
      });
    },

    indexOfSelected() {
      return this.state.elements.findIndex(
        (element) => element.id === this.selectedId
      );
    },
  },
};

module.exports = { ElementListMixin, PALETTE };
