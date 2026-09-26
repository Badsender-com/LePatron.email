const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const { ElementSettingsComponent } = require('./element-settings');
const {
  generate,
  emptyState,
  ELEMENT_ATTRIBUTE,
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
// It writes the generated markup and the state into a block of its own
// (`blockBuilderBlock`), which shares every downstream mechanism with the HTML
// code block — export fidelity, the inliner's protected zone, the sanitised
// preview, a template flag. The builder produces markup; the machinery that
// carries it is the one already in production.
//
// The preview is an iframe, and it is refreshed by replacing the body rather
// than reloading the document: `srcdoc` would flash white and refetch every
// image on each keystroke. Renders are coalesced on requestAnimationFrame
// rather than debounced — the generator is a join of strings, so the cost is
// the reflow, and a timed debounce is exactly what reads as lag.
//
// The preview is also a selection surface: clicking an element there selects
// it. That is what `data-lp-el` on each generated row is for. The iframe is
// same-origin (no `src`, and `sandbox` keeps `allow-same-origin`), so the
// parent can listen on its document even though scripts inside it cannot run.

const PALETTE = [
  { type: 'text', label: 'Texte' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Bouton' },
  { type: 'divider', label: 'Séparateur' },
  { type: 'spacer', label: 'Espaceur' },
];

const DESKTOP_WIDTH = 600;
const MOBILE_WIDTH = 350;

// Marks the selected row inside the preview. Prefixed, because it lands in a
// document that also holds the user's own markup.
const SELECTED_CLASS = 'lp-bb-selected';

// Set on the preview document once it has been written and wired up.
const PREVIEW_READY_FLAG = '__lpBlockBuilderPreview';

// The preview document's own chrome. It is never exported — only the generated
// markup is — so these rules exist purely to make the surface usable: no body
// margin so the block sits at the real template width, and an outline plus a
// pointer cursor so the rows read as clickable.
const PREVIEW_DOCUMENT = [
  '<!DOCTYPE html><html><head><meta charset="utf-8" /><style>',
  'body{margin:0;padding:0;background:#ffffff;}',
  'table{border-collapse:collapse;}',
  'img{max-width:100%;}',
  `[${ELEMENT_ATTRIBUTE}]{cursor:pointer;}`,
  `[${ELEMENT_ATTRIBUTE}].${SELECTED_CLASS}{`,
  'outline:2px solid #00acdc;outline-offset:-2px;}',
  '</style></head><body></body></html>',
].join('');

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
    // Only the outline moves, so the body is left alone — re-rendering it would
    // refetch the images on every change of selection.
    selectedId() {
      this.applySelectionHighlight();
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

    // The preview document, written once and then only ever refilled.
    //
    // Guarded by a flag on the document rather than by `!doc.body`: a fresh
    // src-less iframe is already at about:blank *with* an empty body, so that
    // test skipped the write — and with it the stylesheet. The flag disappears
    // with the document, and the modal destroys its content on close
    // (`v-if="isOpen"`), so a reopened modal writes a new one.
    ensurePreviewDocument() {
      const frame = this.$refs.previewFrame;
      if (!frame || !frame.contentDocument) return null;
      if (frame.contentDocument[PREVIEW_READY_FLAG]) {
        return frame.contentDocument;
      }

      frame.contentDocument.open();
      frame.contentDocument.write(PREVIEW_DOCUMENT);
      frame.contentDocument.close();

      // Re-read it: `close()` can hand back a different document object.
      const doc = frame.contentDocument;
      doc[PREVIEW_READY_FLAG] = true;
      doc.addEventListener('click', this.handlePreviewClick);
      return doc;
    },

    renderPreview() {
      const doc = this.ensurePreviewDocument();
      if (!doc || !doc.body) return;

      // Replacing the body, never the document: reloading is what makes images
      // flicker and the scroll jump.
      doc.body.innerHTML = this.html;
      this.applySelectionHighlight();
    },

    // Selecting by clicking the rendered block, rather than only through the
    // list on the left. `closest` walks up from whatever was actually clicked —
    // a word inside a paragraph, a pixel of an image — to the row that carries
    // the element id.
    handlePreviewClick(event) {
      // The preview holds real links: a button renders an `<a href>`, and
      // clicking one would navigate the iframe away from the composition.
      event.preventDefault();

      const target = event.target;
      const row =
        target && typeof target.closest === 'function'
          ? target.closest(`[${ELEMENT_ATTRIBUTE}]`)
          : null;
      if (!row) return;

      const id = row.getAttribute(ELEMENT_ATTRIBUTE);
      if (this.state.elements.some((element) => element.id === id)) {
        this.selectedId = id;
      }
    },

    // Marks the selected row in the preview, so the selection reads the same on
    // both sides. Re-applied after every render, since replacing the body drops
    // the class with everything else.
    //
    // Compared attribute by attribute rather than through a CSS selector: the
    // id comes from stored state, which is treated as hostile everywhere else
    // (see state.js), and there are at most a handful of rows.
    applySelectionHighlight() {
      const frame = this.$refs.previewFrame;
      const doc = frame && frame.contentDocument;
      if (!doc || !doc.body) return;

      const rows = doc.body.querySelectorAll(`[${ELEMENT_ATTRIBUTE}]`);
      Array.prototype.forEach.call(rows, (row) => {
        const selected = row.getAttribute(ELEMENT_ATTRIBUTE) === this.selectedId;
        row.classList.toggle(SELECTED_CLASS, selected);
      });
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
