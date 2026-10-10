'use strict';

// Metadata tooltip for a gallery thumbnail (US-09). Bare Vue + inline
// template, no Vuetify (see AGENTS.md).
//
// ONE instance, owned by the panel, not one per cell. Two reasons, and both
// are constraints rather than preferences:
//
//   - a tooltip rendered inside a thumbnail would be clipped twice: the
//     thumbnail is `overflow: hidden`, and the virtual scroller positions its
//     cells absolutely inside a scrolling box. Vue 2 has no teleport.
//   - the 500ms delay and the "leave dismisses immediately" rule live in one
//     place instead of one timer per cell across a recycling pool.
//
// The panel tells it which file to describe and where the cell is; it places
// itself relative to the panel.

// Enough hover to mean "tell me more", short enough not to feel stuck.
const OPEN_DELAY_MS = 500;

const GAP = 8;

module.exports = {
  name: 'GalleryTooltip',
  props: {
    // the file to describe, or null when nothing is hovered
    file: { type: Object, default: null },
    // the hovered cell, in viewport coordinates
    anchor: { type: Object, default: null },
    // the panel's own box, so the tooltip can place itself inside it
    bounds: { type: Object, default: null },
    strings: { type: Object, required: true },
  },
  computed: {
    label() {
      return this.file ? this.file.label || this.file.name : '';
    },
    format() {
      const match = /\.([a-z0-9]+)$/i.exec((this.file && this.file.name) || '');
      return match ? match[1].toUpperCase() : '';
    },
    // Null for anything uploaded before US-09 whose bytes could not be read
    // back. The line is dropped rather than showing "0 × 0".
    dimensions() {
      if (!this.file || !this.file.width || !this.file.height) return null;
      return `${this.file.width} × ${this.file.height} px`;
    },
    uploadedAt() {
      if (!this.file || !this.file.uploadedAt) return null;
      const date = new Date(this.file.uploadedAt);
      if (Number.isNaN(date.getTime())) return null;
      // `undefined` would follow the browser's locale, which is not the
      // editor's: a French interface was printing "8 October 2026". The tag
      // rides along with the rest of the copy, the only channel here that
      // already knows which language is in use.
      return date.toLocaleDateString(this.strings.locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    },
    // Clamped to the panel on both axes, so a thumbnail in the last column
    // cannot push the tooltip off the sidebar and one near an edge cannot push
    // it out of view.
    //
    // The side is chosen by whichever has more room, and `maxHeight` is capped
    // to exactly that room. Measuring the rendered tooltip would be the other
    // way, but it needs a second pass and flickers; comparing the two gaps is
    // decided before the first paint and cannot overflow. The first attempt
    // here compared the space above against a guessed 120px, which put a 117px
    // tooltip flush against the top edge the moment a cell sat 124px down.
    position() {
      if (!this.anchor || !this.bounds) return null;

      const width = Math.min(240, this.bounds.width - GAP * 2);
      const half = width / 2;
      const centre = this.anchor.left + this.anchor.width / 2;
      const min = this.bounds.left + GAP + half;
      const max = this.bounds.right - GAP - half;
      const left = Math.max(min, Math.min(max, centre)) - this.bounds.left;

      const topInPanel = this.anchor.top - this.bounds.top;
      const bottomInPanel = this.anchor.bottom - this.bounds.top;
      const roomAbove = topInPanel - GAP * 2;
      const roomBelow = this.bounds.height - bottomInPanel - GAP * 2;
      const above = roomAbove >= roomBelow;

      return {
        width: `${width}px`,
        left: `${left - half}px`,
        maxHeight: `${Math.max(0, above ? roomAbove : roomBelow)}px`,
        top: above ? 'auto' : `${bottomInPanel + GAP}px`,
        bottom: above ? `${this.bounds.height - topInPanel + GAP}px` : 'auto',
      };
    },
  },
  template: `
    <div
      v-if="file && position"
      class="gallery-tooltip"
      data-gallery-tooltip
      role="tooltip"
      :style="position"
    >
      <p class="gallery-tooltip__label">{{ label }}</p>
      <dl class="gallery-tooltip__meta">
        <template v-if="dimensions">
          <dt>{{ strings.dimensions }}</dt>
          <dd data-gallery-tooltip-dimensions>{{ dimensions }}</dd>
        </template>
        <template v-if="format">
          <dt>{{ strings.format }}</dt>
          <dd>{{ format }}</dd>
        </template>
        <template v-if="uploadedAt">
          <dt>{{ strings.uploadedAt }}</dt>
          <dd>{{ uploadedAt }}</dd>
        </template>
      </dl>
    </div>
  `,
};

module.exports.OPEN_DELAY_MS = OPEN_DELAY_MS;
