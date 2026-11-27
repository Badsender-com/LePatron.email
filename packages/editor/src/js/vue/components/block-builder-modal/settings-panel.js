'use strict';

// What the panel on the right says about the selection
// (settings-panel-template.js): where a selected element sits, and the way
// back to its row; which row is selected, and which of its columns is chosen.
//
// A Vue 2 mixin, like the selection it reads: the component is expected to
// provide `vm`, and from selection.js `selectedRowIndex`, `activeColumnPlace`,
// `chosenColumn`, `locateElement`, `selectedElementId` and `selectColumn`.

const SettingsPanelMixin = {
  computed: {
    // "Row 2 · Column 1", where the selected element sits: the panel shows
    // an element's settings away from the list that places it.
    selectedPlaceLabel() {
      const place = this.activeColumnPlace;
      return place ? this.vm.t('block-builder-elements-column', place) : '';
    },

    // "Row 2", the title of a selected row's settings.
    selectedRowTitle() {
      const index = this.selectedRowIndex;
      return index === -1
        ? ''
        : this.vm.t('block-builder-row-title', { n: index + 1 });
    },
  },
  methods: {
    isChosenColumn(index) {
      return Boolean(this.chosenColumn) && this.chosenColumn.index === index;
    },

    // From an element to the settings of its row, with its column chosen so
    // the palette keeps adding where the user was working.
    selectRowOfSelected() {
      const place = this.locateElement(this.selectedElementId);
      if (!place) return;
      this.selectColumn(place.row.id, place.row.columns.indexOf(place.column));
    },
  },
};

module.exports = { SettingsPanelMixin };
