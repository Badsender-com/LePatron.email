const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const { ElementSettingsComponent } = require('./element-settings');
const { PreviewSurfaceMixin } = require('./preview-surface.js');
const { DragSurfaceMixin } = require('./drag-surface.js');
const MODAL_TEMPLATE = require('./modal-template.js');
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


let sequence = 0;
const nextId = () => `el-${Date.now().toString(36)}-${++sequence}`;

const defaultsFor = (type) => {
  const definition = ELEMENTS.find((element) => element.type === type);
  return definition ? { ...definition.defaults } : {};
};

// What a brand new element says before anyone types into it.
//
// Here and not in the generator's defaults, on purpose: those defaults are the
// fallback for a stored state that is missing a key, so seeding them would put
// the placeholder back into a text the user had deliberately emptied, on every
// reload.
//
// An element that renders nothing appears nowhere — that is the whole reason
// this exists. The image has no seed because there is nothing honest to put in
// it; the preview's `min-height` keeps its slot visible and clickable until a
// picture is chosen.
const SEED_KEYS = {
  text: { key: 'content', label: 'block-builder-seed-text' },
  button: { key: 'label', label: 'block-builder-seed-button' },
};

const BlockBuilderModalComponent = Vue.component('BlockBuilderModal', {
  components: { ModalComponent, ElementSettings: ElementSettingsComponent },
  // Two surfaces, each with its own file: the preview writes the iframe and
  // carries the selection, the drag adds the gesture on top of it.
  mixins: [PreviewSurfaceMixin, DragSurfaceMixin],
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
    // What is being dragged: a palette entry to insert, or an element already
    // in the block to move. Never both.
    draggingType: null,
    draggingId: null,
    dropIndex: null,
    // A render that fell due mid-drag and was held back.
    renderHeldDuringDrag: false,
  }),
  computed: {
    selected() {
      return (
        this.state.elements.find(
          (element) => element.id === this.selectedId
        ) || null
      );
    },
    // What the block will actually store and mail: no element ids, which are
    // editing chrome and have no business in a recipient's inbox.
    html() {
      return generate(this.state);
    },

    // What the preview renders. Same markup plus the ids the selection and the
    // drag need — they never leave this iframe.
    previewMarkup() {
      return generate(this.state, { elementIds: true });
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
    // Watching what the preview actually renders, not what the block will
    // store: the two differ by the element ids now.
    previewMarkup() {
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

    // Builds an element, seeded so it is visible the moment it lands.
    buildElement(type) {
      const element = { id: nextId(), type, ...defaultsFor(type) };
      const seed = SEED_KEYS[type];
      if (seed) element[seed.key] = this.vm.t(seed.label);
      return element;
    },

    // Clicking a palette entry appends. It stays alongside the drag: it is the
    // quick path, it is what a keyboard reaches, and it is the fallback when a
    // drag is dropped somewhere that refuses it.
    addElement(type) {
      this.insertElement(type, this.state.elements.length);
    },

    insertElement(type, index) {
      if (!PALETTE.some((item) => item.type === type)) return null;

      const element = this.buildElement(type);
      const at = Math.max(0, Math.min(index, this.state.elements.length));
      this.state.elements.splice(at, 0, element);
      // Selected on arrival, so the settings panel is already on it — dropping
      // and editing are one gesture, not two.
      this.selectedId = element.id;
      return element;
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
      this.draggingType = null;
      this.draggingId = null;
      this.dropIndex = null;
      this.renderHeldDuringDrag = false;
      this.accessor = null;
      this.stateAccessor = null;
      this.replacesExistingMarkup = false;
      this.state = emptyState();
      this.selectedId = null;
      this.$refs.modalRef?.closeModal();
    },
  },
  template: MODAL_TEMPLATE,
});

module.exports = { BlockBuilderModalComponent };
