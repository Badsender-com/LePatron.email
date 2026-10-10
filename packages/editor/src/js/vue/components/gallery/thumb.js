'use strict';

// Gallery thumbnail (US-05). Bare Vue + inline template, no Vuetify (see AGENTS.md).
// Emits:
//   - `select` (file): click to use the image (KO $root.addImage)
//   - `remove` (file): delete the image (KO $root.removeImage) — ISO with old grid
const { fileExt } = require('../../../../../../shared/gallery/filter.js');

module.exports = {
  name: 'Thumb',
  props: {
    file: { type: Object, required: true },
  },
  computed: {
    label() {
      return this.file.label || this.file.name;
    },
    // the same reader the filter chips use, so a thumbnail and the chip that
    // selected it can never disagree on what format an image is
    format() {
      return fileExt(this.file);
    },
    // JPG has no transparency → solid background instead of the checkerboard.
    // fileExt already folds jpeg into jpg.
    isSolid() {
      return this.format === 'jpg';
    },
    isGif() {
      return this.format === 'gif';
    },
  },
  template: `
    <div class="gallery-thumb" @click="$emit('select', file)">
      <button
        type="button"
        class="gallery-thumb__remove"
        @click.stop="$emit('remove', file)"
      >
        <span class="lucide lucide-x"></span>
      </button>
      <span v-if="isGif" class="gallery-thumb__badge gallery-thumb__badge--gif">GIF</span>
      <div
        class="gallery-thumb__img"
        :class="{ 'gallery-thumb__img--solid': isSolid }"
      >
        <img :src="file.thumbnailUrl" :alt="label" />
      </div>
      <div class="gallery-thumb__label" :title="label">{{ label }}</div>
    </div>
  `,
};
