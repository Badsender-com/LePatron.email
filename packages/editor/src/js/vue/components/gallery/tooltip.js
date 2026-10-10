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
//
// ACCEPTED LIMITATION — this tooltip is mouse-only. It opens on `mouseenter`
// and nothing else: there is no keyboard path to it (the thumbnail is not
// focusable) and no touch path. The dimensions and the upload date are
// therefore unavailable to a keyboard or touch user. `pointer-events: none`
// also makes it physically unreachable, so its text cannot be selected.
// Knowingly deferred for V1 by the product owner; making the grid focusable
// is the prerequisite and belongs to its own ticket.

// Enough hover to mean "tell me more", short enough not to feel stuck.
const OPEN_DELAY_MS = 500;

const GAP = 8;

// Below this there is not enough room to show anything useful, and a 0px box
// with `overflow: hidden` is a tooltip that opens invisibly.
const MIN_HEIGHT = 56;
const MIN_WIDTH = 140;

module.exports = {
  name: 'GalleryTooltip',
  props: {
    // the file to describe, or null when nothing is hovered
    file: { type: Object, default: null },
    // The hovered cell and the panel's own box, in viewport coordinates.
    // `type: null` because these are DOMRects: Vue 2 checks `Object` with
    // `isPlainObject`, which a DOMRect fails, and the dev build would warn
    // twice on every open.
    anchor: { type: null, default: null },
    bounds: { type: null, default: null },
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
      const format = { year: 'numeric', month: 'long', day: 'numeric' };
      // `undefined` would follow the browser's locale, which is not the
      // editor's: a French interface was printing "8 October 2026". The tag
      // travels as a translation value so a translator owns the regional
      // variant — which also means a typo in a translation file reaches here.
      // `toLocaleDateString` throws a RangeError on a malformed tag, and this
      // runs inside a computed the template reads: unguarded, one bad string
      // blanks the whole panel.
      try {
        return date.toLocaleDateString(this.strings.locale, format);
      } catch (error) {
        return date.toLocaleDateString(undefined, format);
      }
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
      const room = above ? roomAbove : roomBelow;

      // Nothing rather than a sliver: a short panel used to render a 0px box
      // that `v-if` considered open and the user could not see.
      if (room < MIN_HEIGHT || width < MIN_WIDTH) return null;

      return {
        width: `${width}px`,
        left: `${left - half}px`,
        maxHeight: `${room}px`,
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
