'use strict';

// Gallery thumbnail (US-05, US-08, US-11). Bare Vue + inline template, no
// Vuetify (see AGENTS.md).
// Emits:
//   - `select` (file): click to use the image (KO $root.addImage)
//   - `edit` (file): reopen the Konva editor on this image (US-10)
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
// keyboard path to renaming is the overlay's rename button instead, which is
// what ADR-0005 planned for it anyway.
//
// That same exclusion is why the overlay's action bar is kept small and the
// overlay itself never takes the pointer: see the template below.
//
// The root is not the button. Buttons nested in an element with
// `role="button"` have their own role flattened away and are read as plain
// text by a screen reader. So the image is the "insert" control — Tab, then
// Enter or Space — and the action bar is its sibling, three real buttons
// that come next in the tab order. A pointer click anywhere on the tile still
// inserts: that handler sits on the root, and the image control's click
// reaches it by bubbling, so an assistive technology activating the control
// inserts exactly once.
const {
  fileExt,
  isEditableImage,
} = require('../../../../../../shared/gallery/filter.js');
const {
  sanitizeLabel,
  MAX_LABEL_LENGTH,
} = require('../../../../../../shared/gallery/label.js');
const { fillLabel } = require('../../utils/fill-label.js');

module.exports = {
  name: 'Thumb',
  props: {
    file: { type: Object, required: true },
    // the panel hands its copy down, so the thumbnail needs no access to the
    // Mosaico viewModel of its own
    strings: { type: Object, required: true },
    // Whether the user holds `gallery.manage`, read by the panel from the
    // current user. The server refuses a rename, a re-upload and a delete
    // without it; a button that can only fail is not shown (AGENTS.md,
    // "Rights"). Denied until told otherwise, like `userCan` itself.
    canManage: { type: Boolean, default: false },
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
    // The Konva editor is skipped for GIF and SVG by the upload pipeline
    // itself (badsender-fileupload-extension), because it flattens what it
    // opens — an animated GIF would come back as a single still frame.
    //
    // The button is dropped rather than disabled. Clicking it would have
    // re-uploaded the identical bytes, and the content-addressed name turns
    // that into a no-op nothing on screen reports; and a disabled button is
    // the one place a `title` does not reliably show, so the explanation
    // would have been invisible anyway. The GIF badge already says why.
    canEdit() {
      return isEditableImage(this.file);
    },
    editTitle() {
      return this.withLabel(this.strings.editAction);
    },
    renameTitle() {
      return this.withLabel(this.strings.renameAction);
    },
    removeTitle() {
      return this.withLabel(this.strings.remove);
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
    // The three overlay buttons are icons with no text, side by side on every
    // cell. Naming the image in each one is what tells "delete" on this
    // thumbnail apart from "delete" on the next, both in a screen reader's
    // list of buttons and for voice control.
    withLabel(template) {
      return fillLabel(template, this.label);
    },
    startEdit() {
      // the label's double-click is the second way in, and has to be refused
      // on the same terms as the rename button
      if (this.editing || !this.canManage) return;
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
    // A rename starts with a double-click on the label, whose first click
    // must not insert the image (ADR 0005). Without the right to rename there
    // is no double-click to protect, and the band inserts like the rest.
    onLabelClick(event) {
      if (this.canManage) event.stopPropagation();
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
      <span v-if="isGif" class="gallery-thumb__badge gallery-thumb__badge--gif">GIF</span>
      <div class="gallery-thumb__media">
        <div
          class="gallery-thumb__img"
          :class="{ 'gallery-thumb__img--solid': isSolid }"
          role="button"
          tabindex="0"
          :aria-label="label"
          data-gallery-pick
          @keydown.enter.prevent="$emit('select', file)"
          @keydown.space.prevent="$emit('select', file)"
        >
          <img :src="file.thumbnailUrl" :alt="label" />
        </div>
        <!-- Actions on hover (US-08), inside the image area only: the label
             band below stays reachable, which is what a rename double-click
             needs (ADR-0005).

             The overlay keeps \`pointer-events: none\` even while visible, and
             only the small action bar takes the pointer back. The mockup gave
             the whole overlay \`pointer-events: auto\` on hover, which would
             have covered the image area — and jQuery UI's draggable excludes
             buttons from its handle, so that version made the thumbnail
             undraggable exactly while the user could see it. -->
        <div class="gallery-thumb__overlay" data-gallery-overlay>
          <div v-if="canManage" class="gallery-thumb__actions">
            <button
              v-if="canEdit"
              type="button"
              class="gallery-thumb__action"
              data-gallery-edit
              :title="editTitle"
              :aria-label="editTitle"
              @click.stop="$emit('edit', file)"
            >
              <span class="lucide lucide-pencil"></span>
            </button>
            <button
              type="button"
              class="gallery-thumb__action"
              data-gallery-rename
              :title="renameTitle"
              :aria-label="renameTitle"
              @click.stop="startEdit"
            >
              <span class="lucide lucide-tag"></span>
            </button>
            <button
              type="button"
              class="gallery-thumb__action gallery-thumb__action--danger"
              data-gallery-remove
              :title="removeTitle"
              :aria-label="removeTitle"
              @mousedown="onRemoveDown"
              @click.stop="$emit('remove', file)"
            >
              <span class="lucide lucide-trash-2"></span>
            </button>
          </div>
        </div>
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
        @click="onLabelClick"
        @dblclick.stop="startEdit"
      >{{ label }}</div>
    </div>
  `,
};
