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

const ElementListMixin = {
  data: () => ({ palette: PALETTE }),
  methods: {
    labelFor(element) {
      const entry = PALETTE.find((item) => item.type === element.type);
      const name = entry ? this.vm.t(entry.labelKey) : element.type;
      if (element.type === 'text' && element.content) {
        // The first words, so a list of five texts is still readable.
        const plain = element.content.replace(/<[^>]*>/g, '').trim();
        if (plain) return `${name} — ${plain.slice(0, 28)}`;
      }
      if (element.type === 'button' && element.label) {
        return `${name} — ${element.label.slice(0, 28)}`;
      }
      return name;
    },

    addElement(type) {
      const element = { id: newElementId(), type, ...defaultsFor(type) };
      this.state.elements.push(element);
      this.selectedId = element.id;
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

    indexOfSelected() {
      return this.state.elements.findIndex(
        (element) => element.id === this.selectedId
      );
    },
  },
};

module.exports = { ElementListMixin, PALETTE };
