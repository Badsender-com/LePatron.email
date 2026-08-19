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
    maxLength: HTML_CODE_MAX_LENGTH,
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
      this.accessor = data && data.accessor;
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
        mode: 'htmlmixed',
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 2,
        indentWithTabs: false,
        // No auto-formatting, ever: the pasted markup must survive untouched.
        autoCloseTags: false,
        electricChars: false,
        // Hint only, never persisted in the model (addon/display/placeholder.js).
        placeholder: this.vm.t('html-code-placeholder'),
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
      const result = validateHtmlCodeLength(this.editor.getValue());
      this.length = result.length;
      this.tooLong = !result.valid;
    },

    handleApply() {
      if (!this.editor || !this.accessor) return;
      const value = this.editor.getValue();
      const result = validateHtmlCodeLength(value);
      if (!result.valid) {
        this.vm.notifier.error(
          this.vm.t('html-code-too-large', { max: result.maxLength })
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
      this.tooLong = false;
      this.length = 0;
      this.$refs.modalRef?.closeModal();
    },
  },
  template: `<modal-component ref="modalRef" :is-full-width="true" :on-close="destroyEditor">
  <div class="modal-content html-code-modal">
    <h5 class="html-code-modal__title">{{ vm.t('html-code-modal-title') }}</h5>
    <div class="html-code-modal__editor">
      <textarea ref="codeArea"></textarea>
    </div>
    <p class="html-code-modal__counter" :class="{ 'html-code-modal__counter--error': tooLong }">
      {{ length }} / {{ maxLength }}
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
