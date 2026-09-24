const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const {
  validateHtmlCodeLength,
} = require('../../../ext/html-code-block/validate.js');
const {
  HTML_CODE_MAX_LENGTH,
} = require('../../../ext/html-code-block/constants.js');

// CodeMirror comes from the concatenated editor libs as a global, like tinymce
// (see gulpfile.js mosaicoLibList).
const getCodeMirror = () =>
  typeof window !== 'undefined' ? window.CodeMirror : null;

// What the caller may override when opening the editor. The defaults are the
// HTML code block, so `toggleHtmlCodeModal(true, { accessor })` behaves exactly
// as it did before this became reusable. The head CSS editor passes its own
// mode, labels and bound (see viewModel.openHeadCssEditor).
const DEFAULT_OPTIONS = {
  mode: 'htmlmixed',
  titleKey: 'html-code-modal-title',
  placeholderKey: 'html-code-placeholder',
  tooLargeKey: 'html-code-too-large',
  maxLength: HTML_CODE_MAX_LENGTH,
};

const HtmlCodeModalComponent = Vue.component('HtmlCodeModal', {
  components: {
    ModalComponent,
  },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    accessor: null,
    editor: null,
    tooLong: false,
    length: 0,
    options: { ...DEFAULT_OPTIONS },
  }),
  mounted() {
    this.vm.toggleHtmlCodeModal = this.handleToggle;
  },
  beforeDestroy() {
    this.destroyEditor();
  },
  methods: {
    handleToggle(value, data) {
      if (!value) {
        this.closeModal();
        return;
      }
      const { accessor, ...overrides } = data || {};
      this.accessor = accessor;
      this.options = { ...DEFAULT_OPTIONS, ...overrides };
      this.$refs.modalRef?.openModal();
      // The <textarea> only exists once the modal is rendered.
      this.$nextTick(this.createEditor);
    },

    createEditor() {
      const CodeMirror = getCodeMirror();
      const textarea = this.$refs.codeArea;
      if (!CodeMirror || !textarea) return;

      const value = this.accessor ? this.accessor() || '' : '';
      this.editor = CodeMirror.fromTextArea(textarea, {
        mode: this.options.mode,
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 2,
        indentWithTabs: false,
        // No auto-formatting, ever: the pasted markup must survive untouched.
        autoCloseTags: false,
        electricChars: false,
        // Hint only, never persisted in the model (addon/display/placeholder.js).
        placeholder: this.vm.t(this.options.placeholderKey),
      });
      this.editor.setValue(value);
      this.editor.on('change', this.handleChange);
      this.handleChange();
      this.editor.focus();
    },

    destroyEditor() {
      if (!this.editor) return;
      this.editor.off('change', this.handleChange);
      // Restores the original <textarea>, which Vue then discards with the modal.
      this.editor.toTextArea();
      this.editor = null;
    },

    handleChange() {
      if (!this.editor) return;
      const result = validateHtmlCodeLength(
        this.editor.getValue(),
        this.options.maxLength
      );
      this.length = result.length;
      this.tooLong = !result.valid;
    },

    handleApply() {
      if (!this.editor || !this.accessor) return;
      const value = this.editor.getValue();
      const result = validateHtmlCodeLength(value, this.options.maxLength);
      if (!result.valid) {
        this.vm.notifier.error(
          this.vm.t(this.options.tooLargeKey, { max: result.maxLength })
        );
        return;
      }

      // One undo step for the whole edit: writing on every keystroke would push
      // a full copy of the markup onto the 100-level undo stack each time.
      this.vm.startMultiple();
      this.accessor(value);
      this.vm.stopMultiple();
      this.closeModal();
    },

    closeModal() {
      this.destroyEditor();
      this.accessor = null;
      this.options = { ...DEFAULT_OPTIONS };
      this.tooLong = false;
      this.length = 0;
      this.$refs.modalRef?.closeModal();
    },
  },
  template: `<modal-component ref="modalRef" :is-full-width="true" :on-close="destroyEditor">
  <div class="modal-content html-code-modal">
    <h5 class="html-code-modal__title">{{ vm.t(options.titleKey) }}</h5>
    <div class="html-code-modal__editor">
      <textarea ref="codeArea"></textarea>
    </div>
    <p class="html-code-modal__counter" :class="{ 'html-code-modal__counter--error': tooLong }">
      {{ length }} / {{ options.maxLength }}
    </p>
  </div>
  <div class="modal-footer">
    <button
      @click.prevent="closeModal"
      class="btn-flat waves-effect waves-light"
      name="closeAction">
      {{ vm.t('html-code-modal-cancel') }}
    </button>
    <button
      @click.prevent="handleApply"
      :disabled="tooLong"
      class="btn waves-effect waves-light"
      type="submit"
      name="submitAction">
      {{ vm.t('html-code-modal-apply') }}
    </button>
  </div>
</modal-component>
  `,
});

module.exports = {
  HtmlCodeModalComponent,
};
