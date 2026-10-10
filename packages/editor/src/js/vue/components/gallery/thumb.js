'use strict';

// Gallery thumbnail (US-05, US-11). Bare Vue + inline template, no Vuetify
// (see AGENTS.md).
// Emits:
//   - `select` (file): click to use the image (KO $root.addImage)
//   - `remove` (file): delete the image (KO $root.removeImage) — ISO with old grid
//   - `rename` (file, label): a new label was committed (KO $root.renameImage)
//   - `hover` (file, element) / `unhover`: the panel owns the single metadata
//     tooltip, because one rendered in here would be clipped by this element's
//     own `overflow: hidden` and by the virtual scroller
//   - `reject` (messageKey): the input was refused before reaching the server
//
// The label band is a plain element, not a button: jQuery UI's draggable
// excludes `input, textarea, button, select, option` from its drag handle, so
// making it a button took the band out of the thumbnail's drag area. The whole
// thumbnail — image and label — has to stay draggable onto the email. The
// keyboard path to renaming therefore waits for the dedicated button US-08 puts
// in the hover overlay, which is what ADR-0002 planned for it anyway.
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
    //
    // Watches the name, not the object: the gallery replaces entries in place
    // — a rename, a delete elsewhere in the list — and watching identity
    // closed the editor and threw away the draft every time that happened.
    'file.name': function onRecycled() {
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
      // unchanged is a no-op; empty is a refusal, and used to be a silent one
      if (next === this.label) return;
      if (!next) {
        this.$emit('reject', 'gallery-rename-image-empty');
        return;
      }
      this.$emit('rename', this.file, next);
    },
    // Enter also confirms a candidate in an IME. Committing then would save a
    // half-composed word and close the editor mid-sentence.
    onEnter(event) {
      if (event.isComposing || event.keyCode === 229) return;
      this.commitEdit();
    },
    // Blur commits, so clicking the delete button would first save a rename on
    // an image that is about to disappear. Drop the edit before that click
    // lands — mousedown runs before the input loses focus.
    onRemoveDown() {
      this.editing = false;
    },
  },
  template: `
    <div
      class="gallery-thumb"
      @click="editing || $emit('select', file)"
      @mouseenter="$emit('hover', file, $event.currentTarget)"
      @mouseleave="$emit('unhover')"
    >
      <button
        type="button"
        class="gallery-thumb__remove"
        :title="strings.remove"
        :aria-label="strings.remove"
        @mousedown="onRemoveDown"
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
        @keyup.enter="onEnter"
        @keyup.esc="cancelEdit"
        @blur="commitEdit"
      />
      <div
        v-else
        class="gallery-thumb__label"
        data-gallery-label
        @click.stop
        @dblclick.stop="startEdit"
      >{{ label }}</div>
    </div>
  `,
};
