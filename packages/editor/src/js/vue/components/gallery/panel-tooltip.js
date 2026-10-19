'use strict';

const Tooltip = require('./tooltip');

/**
 * The metadata tooltip the gallery panel owns: one for the whole grid, not
 * one per cell (see tooltip.js). Mixed into the panel, which renders it and
 * calls `onHover` / `onUnhover` from the thumbnails and the scroller; it
 * reads the panel's `visibleImages`.
 *
 * @param {Object} vm the Mosaico viewModel, for the translations
 * @returns {Object} a Vue mixin
 */
function createPanelTooltip(vm) {
  return {
    data: () => ({
      // what the tooltip describes, the hovered cell's box and the panel's,
      // both measured when it opens
      hoveredFile: null,
      hoveredAnchor: null,
      panelBounds: null,
    }),
    computed: {
      tooltipStrings() {
        return {
          // a translation entry whose value is a locale tag, so the date
          // follows the editor's language rather than the browser's
          locale: vm.t('gallery-date-locale'),
          dimensions: vm.t('gallery-tooltip-dimensions'),
          format: vm.t('gallery-tooltip-format'),
          uploadedAt: vm.t('gallery-tooltip-uploaded-at'),
        };
      },
    },
    watch: {
      // Chrome fires no mouseleave on an element removed from the DOM, so
      // deleting the hovered image left its tooltip on screen describing a
      // file that no longer exists. A rename replaces the entry rather than
      // editing it, so the tooltip takes the new one.
      visibleImages(images) {
        if (!this.hoveredFile) return;
        const { name } = this.hoveredFile;
        const current = images.find((file) => file.name === name);
        if (current) this.hoveredFile = current;
        else this.onUnhover();
      },
    },
    created() {
      this._hoverTimer = null;
    },
    beforeDestroy() {
      this.cancelHover();
    },
    methods: {
      // A delay, so sweeping across the grid on the way somewhere else does
      // not flash a tooltip over every cell on the path. One timer for the
      // panel, restarted from cell to cell.
      onHover(file, element) {
        this.cancelHover();
        this._hoverTimer = setTimeout(() => {
          // the scroller may have recycled this cell away during the delay
          if (!element.isConnected) return;
          this.hoveredFile = file;
          this.hoveredAnchor = element.getBoundingClientRect();
          this.panelBounds = this.$el.getBoundingClientRect();
        }, Tooltip.OPEN_DELAY_MS);
      },
      // Immediate on leave: a tooltip that lingers covers what the pointer is
      // heading for. Also on scroll: the tooltip is placed once, from the
      // cell's box, and a scroll slides another image under a pointer that
      // has not moved, so no mouseleave comes.
      onUnhover() {
        this.cancelHover();
        this.hoveredFile = null;
        this.hoveredAnchor = null;
      },
      cancelHover() {
        if (this._hoverTimer) clearTimeout(this._hoverTimer);
        this._hoverTimer = null;
      },
    },
  };
}

module.exports = { createPanelTooltip };
