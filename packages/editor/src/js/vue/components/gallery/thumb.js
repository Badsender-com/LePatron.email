'use strict';

// Gallery thumbnail (US-05, US-11). Bare Vue + inline template, no Vuetify
// (see AGENTS.md).
// Emits:
//   - `select` (file): click to use the image (KO $root.addImage)
//   - `remove` (file): delete the image (KO $root.removeImage) — ISO with old grid
//   - `rename` (file, label): a new label was committed (KO $root.renameImage)
const { fileExt } = require('../../../../../../shared/gallery/filter.js');
const {
  sanitizeLabel,
  MAX_LABEL_LENGTH,
} = require('../../../../../../shared/gallery/label.js');

module.exports = {
  name: 'Thumb',
  props: {
    file: { type: Object, required: true },
    // the panel hands its copy down, so the thumbnail needs no access to the
    // Mosaico viewModel of its own
    strings: { type: Object, required: true },
  },
  data: () => ({
    editing: false,
    draft: '',
  }),
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
    maxLength() {
      return MAX_LABEL_LENGTH;
    },
  },
  watch: {
    // The scroller recycles a view onto another image. An edit left open would
    // otherwise carry over to whatever image lands in this cell next.
    file() {
      this.editing = false;
    },
  },
  methods: {
    startEdit() {
      if (this.editing) return;
      this.draft = this.label;
      this.editing = true;
      this.$nextTick(() => {
        const input = this.$refs.input;
        if (!input) return;
        input.focus();
        // the whole name is selected: a rename usually replaces it rather than
        // appending to it
        input.select();
      });
    },
    cancelEdit() {
      this.editing = false;
    },
    commitEdit() {
      if (!this.editing) return;
      this.editing = false;
      const next = sanitizeLabel(this.draft);
      // nothing to tell the server if it comes back unchanged, or empty — an
      // empty label would leave the thumbnail with nothing to read
      if (!next || next === this.label) return;
      this.$emit('rename', this.file, next);
    },
  },
  template: `
    <div class="gallery-thumb" @click="$emit('select', file)">
      <button
        type="button"
        class="gallery-thumb__remove"
        :title="strings.remove"
        :aria-label="strings.remove"
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
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        type="text"
        class="gallery-thumb__label gallery-thumb__label--editing"
        data-gallery-label-input
        :maxlength="maxLength"
        :aria-label="strings.renameInput"
        @click.stop
        @dblclick.stop
        @keyup.enter="commitEdit"
        @keyup.esc="cancelEdit"
        @blur="commitEdit"
      />
      <div
        v-else
        class="gallery-thumb__label"
        data-gallery-label
        tabindex="0"
        role="button"
        :title="strings.renameHint + ' — ' + label"
        :aria-label="strings.renameHint + ' — ' + label"
        @click.stop
        @dblclick.stop="startEdit"
        @keydown.enter.stop.prevent="startEdit"
      >{{ label }}</div>
    </div>
  `,
};
