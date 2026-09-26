const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const { ElementSettingsComponent } = require('./element-settings');
const {
  generate,
  emptyState,
} = require('../../../../../../shared/block-builder/generate.js');
const {
  ELEMENTS,
} = require('../../../../../../shared/block-builder/elements/index.js');
const {
  parseState,
  serialiseState,
} = require('../../../../../../shared/block-builder/state.js');

// The composing surface of the block builder.
//
// It writes into the `htmlCode` of an HTML code block, which means everything
// downstream — export fidelity, the inliner's protected zone, the sanitised
// preview, the template flag — is the machinery already in production. The
// builder produces markup; it does not produce a new kind of block.
//
// The preview is an iframe, and it is refreshed by replacing the body rather
// than reloading the document: `srcdoc` would flash white and refetch every
// image on each keystroke. Renders are coalesced on requestAnimationFrame
// rather than debounced — the generator is a join of strings, so the cost is
// the reflow, and a timed debounce is exactly what reads as lag.

const PALETTE = [
  { type: 'text', label: 'Texte' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Bouton' },
  { type: 'divider', label: 'Séparateur' },
  { type: 'spacer', label: 'Espaceur' },
];

const DESKTOP_WIDTH = 600;
const MOBILE_WIDTH = 350;

let sequence = 0;
const nextId = () => `el-${Date.now().toString(36)}-${++sequence}`;

const defaultsFor = (type) => {
  const definition = ELEMENTS.find((element) => element.type === type);
  return definition ? { ...definition.defaults } : {};
};

const BlockBuilderModalComponent = Vue.component('BlockBuilderModal', {
  components: { ModalComponent, ElementSettings: ElementSettingsComponent },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    accessor: null,
    stateAccessor: null,
    // True when the block holds markup but no state the builder can reopen.
    // Since the builder has a block type of its own, nobody can have written
    // that markup by hand: what remains is a state that failed to serialise
    // (serialiseState returns '' rather than half a state) or one stored by a
    // version that did not keep one. Composing REPLACES that markup, so the
    // user is told before they lose it.
    replacesExistingMarkup: false,
    state: emptyState(),
    selectedId: null,
    palette: PALETTE,
    previewWidth: DESKTOP_WIDTH,
    frameRequest: null,
  }),
  computed: {
    selected() {
      return (
        this.state.elements.find(
          (element) => element.id === this.selectedId
        ) || null
      );
    },
    html() {
      return generate(this.state);
    },
    isEmpty() {
      return this.state.elements.length === 0;
    },
    // Translated here, where the view-model is, and handed to the settings
    // panel as plain strings.
    settingsLabels() {
      return {
        empty: this.vm.t('block-builder-select-element'),
        choose: this.vm.t('block-builder-choose-image'),
        change: this.vm.t('block-builder-change-image'),
      };
    },
  },
  watch: {
    html() {
      this.scheduleRender();
    },
  },
  mounted() {
    this.vm.toggleBlockBuilderModal = this.handleToggle;
  },
  beforeDestroy() {
    if (this.frameRequest) window.cancelAnimationFrame(this.frameRequest);
  },
  methods: {
    handleToggle(value, data) {
      if (!value) {
        this.closeModal();
        return;
      }
      this.accessor = data && data.accessor;
      this.stateAccessor = (data && data.stateAccessor) || null;

      const stored = this.stateAccessor ? this.stateAccessor() : null;
      const restored = parseState(stored);
      const existingMarkup = this.accessor ? this.accessor() : '';

      this.state = restored || emptyState();
      // Markup with no state behind it: composing would throw it away.
      this.replacesExistingMarkup =
        !restored && typeof existingMarkup === 'string' && existingMarkup !== '';
      this.selectedId = this.state.elements.length
        ? this.state.elements[0].id
        : null;
      this.previewWidth = DESKTOP_WIDTH;
      this.$refs.modalRef?.openModal();
      this.$nextTick(this.renderPreview);
    },

    labelFor(element) {
      const entry = PALETTE.find((item) => item.type === element.type);
      const name = entry ? entry.label : element.type;
      if (element.type === 'text' && element.content) {
        // The first words, so a list of five texts is still readable.
        const plain = element.content.replace(/<[^>]*>/g, '').trim();
        if (plain) return `${name} — ${plain.slice(0, 28)}`;
      }
      if (element.type === 'button' && element.label) {
        return `${name} — ${element.label.slice(0, 28)}`;
      }
      return name;
    },

    addElement(type) {
      const element = { id: nextId(), type, ...defaultsFor(type) };
      this.state.elements.push(element);
      this.selectedId = element.id;
    },

    removeSelected() {
      const index = this.indexOfSelected();
      if (index === -1) return;
      this.state.elements.splice(index, 1);
      const next = this.state.elements[index] || this.state.elements[index - 1];
      this.selectedId = next ? next.id : null;
    },

    move(offset) {
      const index = this.indexOfSelected();
      const target = index + offset;
      if (index === -1 || target < 0 || target >= this.state.elements.length) {
        return;
      }
      const [element] = this.state.elements.splice(index, 1);
      this.state.elements.splice(target, 0, element);
    },

    indexOfSelected() {
      return this.state.elements.findIndex(
        (element) => element.id === this.selectedId
      );
    },

    // Opens the editor's own image gallery — the same dialog the background
    // image widget uses — rather than a picker of our own. Two reasons: it
    // already carries the uploads, the two tabs and the loading states, and an
    // image chosen there gets the absolute URL the ZIP export and the test send
    // both need. A free URL field would bypass all of that.
    pickImage(key) {
      const vm = this.vm;
      if (typeof vm.currentBgimage !== 'function') return;
      if (typeof vm.showDialogGallery !== 'function') return;

      vm.currentBgimage((url) => this.applySetting({ key, value: url }));
      vm.showDialogGallery(true);
    },

    applySetting({ key, value }) {
      const element = this.selected;
      if (!element) return;
      // `$set`, because a key absent from the element's defaults would not be
      // reactive otherwise (Vue 2).
      this.$set(element, key, value);
    },

    scheduleRender() {
      if (this.frameRequest) return;
      this.frameRequest = window.requestAnimationFrame(() => {
        this.frameRequest = null;
        this.renderPreview();
      });
    },

    renderPreview() {
      const frame = this.$refs.previewFrame;
      const doc = frame && frame.contentDocument;
      if (!doc) return;

      // Written once: replacing the whole document on every render is what
      // makes images flicker and the scroll jump.
      if (!doc.body) {
        doc.open();
        doc.write(
          '<!DOCTYPE html><html><head><meta charset="utf-8" />' +
            '<style>body{margin:0;padding:0;background:#ffffff;}' +
            'table{border-collapse:collapse;}img{max-width:100%;}</style>' +
            '</head><body></body></html>'
        );
        doc.close();
      }
      doc.body.innerHTML = this.html;
    },

    handleApply() {
      if (!this.accessor) return;
      // One undo step for the whole composition — same reason as the HTML code
      // modal: the undo stack copies the model on every entry. Both writes go
      // inside it, so markup and state can never land in separate steps and
      // drift apart under an undo.
      this.vm.startMultiple();
      this.accessor(this.html);
      if (this.stateAccessor) this.stateAccessor(serialiseState(this.state));
      this.vm.stopMultiple();
      this.closeModal();
    },

    closeModal() {
      this.accessor = null;
      this.stateAccessor = null;
      this.replacesExistingMarkup = false;
      this.state = emptyState();
      this.selectedId = null;
      this.$refs.modalRef?.closeModal();
    },
  },
  template: `<modal-component ref="modalRef" :is-full-width="true">
  <div class="modal-content bb-modal">
    <h5 class="bb-modal__title">{{ vm.t('block-builder-modal-title') }}</h5>

    <p v-if="replacesExistingMarkup" class="bb-modal__warning">
      {{ vm.t('block-builder-replaces-markup') }}
    </p>

    <div class="bb-modal__layout">
      <div class="bb-modal__column bb-modal__column--left">
        <p class="bb-modal__section">{{ vm.t('block-builder-add') }}</p>
        <button
          v-for="item in palette"
          :key="item.type"
          type="button"
          class="bb-modal__add"
          @click.prevent="addElement(item.type)">+ {{ item.label }}</button>

        <p class="bb-modal__section">{{ vm.t('block-builder-elements') }}</p>
        <p v-if="isEmpty" class="bb-modal__empty">{{ vm.t('block-builder-empty') }}</p>
        <ul v-else class="bb-modal__list">
          <li
            v-for="element in state.elements"
            :key="element.id"
            class="bb-modal__item"
            :class="{ 'bb-modal__item--on': element.id === selectedId }"
            @click="selectedId = element.id">{{ labelFor(element) }}</li>
        </ul>
        <div v-if="selected" class="bb-modal__actions">
          <button type="button" @click.prevent="move(-1)" title="Monter">↑</button>
          <button type="button" @click.prevent="move(1)" title="Descendre">↓</button>
          <button type="button" @click.prevent="removeSelected" title="Supprimer">✕</button>
        </div>
      </div>

      <div class="bb-modal__column bb-modal__column--preview">
        <div class="bb-modal__toolbar">
          <button
            type="button"
            :class="{ 'bb-modal__toggle--on': previewWidth === 600 }"
            @click.prevent="previewWidth = 600">{{ vm.t('block-builder-desktop') }}</button>
          <button
            type="button"
            :class="{ 'bb-modal__toggle--on': previewWidth === 350 }"
            @click.prevent="previewWidth = 350">{{ vm.t('block-builder-mobile') }}</button>
        </div>
        <div class="bb-modal__stage">
          <iframe
            ref="previewFrame"
            class="bb-modal__frame"
            :style="{ width: previewWidth + 'px' }"
            sandbox="allow-same-origin"
            title="Aperçu"></iframe>
        </div>
        <p class="bb-modal__hint">{{ vm.t('block-builder-preview-hint') }}</p>
      </div>

      <div class="bb-modal__column bb-modal__column--right">
        <element-settings :element="selected" :labels="settingsLabels" @change="applySetting" @pick-image="pickImage" />
      </div>
    </div>
  </div>
  <div class="modal-footer">
    <button @click.prevent="closeModal" class="btn-flat waves-effect waves-light" name="closeAction">
      {{ vm.t('html-code-modal-cancel') }}
    </button>
    <button
      @click.prevent="handleApply"
      :disabled="isEmpty"
      class="btn waves-effect waves-light"
      type="submit"
      name="submitAction">
      {{ vm.t('html-code-modal-apply') }}
    </button>
  </div>
</modal-component>`,
});

module.exports = { BlockBuilderModalComponent };
