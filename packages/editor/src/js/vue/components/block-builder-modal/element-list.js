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

// What a brand new element says before anyone types into it.
//
// Here and not in the generator's defaults, on purpose: those defaults are the
// fallback for a stored state that is missing a key, so seeding them would put
// the placeholder back into a text the user had deliberately emptied, on every
// reload.
//
// An element that renders nothing appears nowhere — that is the whole reason
// this exists. The image has no seed because there is nothing honest to put in
// it; the preview's `min-height` keeps its slot visible and clickable until a
// picture is chosen.
const SEED_KEYS = {
  text: { key: 'content', label: 'block-builder-seed-text' },
  button: { key: 'label', label: 'block-builder-seed-button' },
};

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

    // Builds an element, seeded so it is visible the moment it lands.
    buildElement(type) {
      const element = { id: newElementId(), type, ...defaultsFor(type) };
      const seed = SEED_KEYS[type];
      if (seed) element[seed.key] = this.vm.t(seed.label);
      return element;
    },

    // Clicking a palette entry appends. It stays alongside the drag: it is the
    // quick path, it is what a keyboard reaches, and it is the fallback when a
    // drag is dropped somewhere that refuses it.
    addElement(type) {
      this.insertElement(type, this.state.elements.length);
    },

    insertElement(type, index) {
      if (!PALETTE.some((item) => item.type === type)) return null;

      const element = this.buildElement(type);
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

    move(offset) {
      const index = this.indexOfSelected();
      const target = index + offset;
      if (index === -1 || target < 0 || target >= this.state.elements.length) {
        return;
      }
      const [element] = this.state.elements.splice(index, 1);
      this.state.elements.splice(target, 0, element);
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

module.exports = { ElementListMixin, PALETTE, SEED_KEYS };
