const Vue = require('vue/dist/vue.common');
const {
  sanitizeRichText,
} = require('../../../../../../shared/block-builder/rich-text.js');
const {
  isBlankRichText,
} = require('../../../../../../shared/block-builder/generate.js');

// A TinyMCE field for the builder's text element.
//
// `valid_elements` is deliberately the same list as the generator's sanitiser
// (packages/shared/block-builder/rich-text.js). If the editor were allowed to
// produce more than the sanitiser keeps, a writer would style something, see it
// in the editor, and lose it on apply — the worst kind of surprise, because it
// looks like data loss rather than like a rule.
//
// `forced_root_block: false` for the same reason: TinyMCE otherwise wraps
// everything in `<p>`, which the sanitiser drops. Line breaks stay `<br>`.

// Mirrors ALLOWED in rich-text.js, attributes included: `href` and nothing
// else, so no `target` — the sanitiser drops it, and a link set to open in a new
// window would silently stop doing so on apply. Kept as a literal, in TinyMCE's
// own syntax, and paired with the sanitiser's list by a test.
const VALID_ELEMENTS = 'strong/b,em/i,u,a[href],br';

// TinyMCE 4.5 has no placeholder setting (it came with 5.2), so the field draws
// its own: a class while the value is blank, and the words through CSS
// (`attr(data-placeholder)`). Read off the value rather than the editor's DOM,
// which keeps a bogus `<br>` in an empty body and defeats `:empty` — and with
// the generator's own test, so the field shows its placeholder exactly when the
// preview shows the starter text.

// What the field hands to TinyMCE: the stored text, through the same sanitiser
// the generator applies on the way out. The value comes from a stored state,
// which may have been written by anything — and TinyMCE parses what it is given
// in the editor's own page, before `valid_elements` gets a say.
const toEditable = (value) =>
  sanitizeRichText(typeof value === 'string' ? value : '');

const getTinyMce = () =>
  typeof window !== 'undefined' ? window.tinymce : null;

let sequence = 0;

const RichTextFieldComponent = Vue.component('RichTextField', {
  props: {
    value: { type: String, default: '' },
    // The id of the panel's label for this field; there is no <input> for a
    // <label for> to point at.
    labelledby: { type: String, default: null },
    placeholder: { type: String, default: null },
  },
  data: () => ({
    editorId: `bb-rich-${++sequence}`,
    editor: null,
    // What the editor last held, as TinyMCE serialises it. Compared on every
    // event rather than emitted blindly: NodeChange fires on each caret move,
    // and every emit regenerates and re-renders the whole preview.
    lastContent: null,
  }),
  watch: {
    // The same field — and the same TinyMCE instance — is reused when the
    // selection moves to another text element (the panel does not key it on
    // the element), so the content has to be pushed in rather than only read
    // out. An echo of what the editor just emitted is not pushed back.
    value(next) {
      if (!this.editor || next === this.lastContent) return;
      this.editor.setContent(toEditable(next));
      this.lastContent = this.editor.getContent();
      // Another element's text now: an undo must not bring the previous one's
      // back into this one.
      if (this.editor.undoManager) this.editor.undoManager.clear();
    },
  },
  mounted() {
    this.createEditor();
  },
  beforeDestroy() {
    this.destroyEditor();
  },
  methods: {
    createEditor() {
      const tinymce = getTinyMce();
      const target = this.$refs.field;
      // No TinyMCE in the bundle (or in a test): the textarea fallback in the
      // template stays, and typing still works.
      if (!tinymce || !target) return;

      tinymce.init({
        target,
        inline: true,
        menubar: false,
        statusbar: false,
        toolbar: 'bold italic underline | link unlink | removeformat',
        plugins: ['link paste'],
        valid_elements: VALID_ELEMENTS,
        // The link dialog's target and title fields would write attributes
        // that VALID_ELEMENTS, and the sanitiser after it, both drop.
        target_list: false,
        link_title: false,
        forced_root_block: false,
        // Pasting from Word is the normal case, and its markup is exactly what
        // the sanitiser would throw away.
        paste_as_text: false,
        paste_remove_styles: true,
        setup: (editor) => {
          this.editor = editor;
          editor.on('init', () => {
            editor.setContent(toEditable(this.value));
            this.lastContent = editor.getContent();
          });
          editor.on('change keyup input NodeChange', () => {
            const content = editor.getContent();
            if (content === this.lastContent) return;
            this.lastContent = content;
            this.$emit('input', content);
          });
        },
      });
    },

    destroyEditor() {
      if (!this.editor) return;
      // `remove` rather than `destroy`: it also unregisters the editor from the
      // global tinymce registry, which otherwise keeps growing as the modal is
      // opened and closed.
      this.editor.remove();
      this.editor = null;
      this.lastContent = null;
    },

    onFallbackInput(event) {
      this.$emit('input', event.target.value);
    },
  },
  template: `<div class="bb-rich" :class="{ 'bb-rich--blank': showsPlaceholder }">
  <div
    v-if="editor !== null || hasTinyMce"
    ref="field"
    :id="editorId"
    role="textbox"
    aria-multiline="true"
    :aria-labelledby="labelledby"
    :aria-placeholder="placeholder"
    :data-placeholder="placeholder"
    class="bb-rich__field"></div>
  <textarea
    v-else
    ref="field"
    class="bb-rich__field bb-rich__field--plain"
    rows="4"
    :aria-labelledby="labelledby"
    :placeholder="placeholder"
    :value="value"
    @input="onFallbackInput"></textarea>
</div>`,
  computed: {
    hasTinyMce() {
      return Boolean(getTinyMce());
    },
    showsPlaceholder() {
      return Boolean(this.placeholder) && isBlankRichText(this.value);
    },
  },
});

module.exports = { RichTextFieldComponent, VALID_ELEMENTS };
