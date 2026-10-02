const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const { ElementSettingsComponent, LABEL_KEYS } = require('./element-settings');
const { PreviewSurfaceMixin } = require('./preview-surface.js');
const { ElementListMixin } = require('./element-list.js');
const { DismissalMixin } = require('./dismissal.js');
const { DragSurfaceMixin } = require('./drag-surface.js');
const MODAL_TEMPLATE = require('./modal-template.js');
const {
  validateBlockBuilderLength,
} = require('../../../ext/html-code-block/validate.js');
const {
  generate,
  emptyState,
} = require('../../../../../../shared/block-builder/generate.js');
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

const DESKTOP_WIDTH = 600;
const MOBILE_WIDTH = 350;

const BlockBuilderModalComponent = Vue.component('BlockBuilderModal', {
  components: { ModalComponent, ElementSettings: ElementSettingsComponent },
  // The preview is a surface of its own — writing the iframe document,
  // rendering into it, and the selection it carries. See preview-surface.js.
  // The element list is another: adding, selecting, moving, removing. See
  // element-list.js. The drag adds the gesture on top of the preview — see
  // drag-surface.js. And Escape or a backdrop click ask before losing work —
  // see dismissal.js.
  mixins: [
    PreviewSurfaceMixin,
    ElementListMixin,
    DragSurfaceMixin,
    DismissalMixin,
  ],
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
    // True when the stored markup is not what the current generator makes of
    // the stored state — an older generator wrote it, or the state was cleaned
    // on the way in. The stored markup is frozen until the user applies, and
    // applying rebuilds it, so they are told before rather than surprised after.
    rebuildsMarkup: false,
    // The serialised state an apply was refused for, for its size. Kept rather
    // than a boolean so the message goes as soon as the composition changes.
    refusedState: null,
    state: emptyState(),
    selectedId: null,
    previewWidth: DESKTOP_WIDTH,
    desktopWidth: DESKTOP_WIDTH,
    mobileWidth: MOBILE_WIDTH,
  }),
  computed: {
    selected() {
      return (
        this.state.elements.find((element) => element.id === this.selectedId) ||
        null
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
    tooLarge() {
      return (
        this.refusedState !== null &&
        this.refusedState === serialiseState(this.state)
      );
    },
    // Translated here, where the view-model is, and handed to the settings
    // panel as plain strings keyed by i18n key.
    settingsLabels() {
      return LABEL_KEYS.reduce((labels, key) => {
        labels[key] = this.vm.t(key);
        return labels;
      }, {});
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
        !restored &&
        typeof existingMarkup === 'string' &&
        existingMarkup !== '';
      this.rebuildsMarkup = Boolean(restored) && existingMarkup !== this.html;
      this.selectedId = this.state.elements.length
        ? this.state.elements[0].id
        : null;
      this.previewWidth = DESKTOP_WIDTH;
      this.rememberOpenedState();
      this.$refs.modalRef?.openModal();
      this.$nextTick(this.renderPreview);
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
      const html = this.html;
      const state = serialiseState(this.state);
      // Refused here, in the modal, where the composition can still be cut
      // down: applied, it would make every autosave fail on the server.
      if (!validateBlockBuilderLength(html, state).valid) {
        this.refusedState = state;
        return;
      }
      // One undo step for the whole composition — same reason as the HTML code
      // modal: the undo stack copies the model on every entry. Both writes go
      // inside it, so markup and state can never land in separate steps and
      // drift apart under an undo.
      this.vm.startMultiple();
      this.accessor(html);
      if (this.stateAccessor) this.stateAccessor(state);
      this.vm.stopMultiple();
      this.closeModal();
    },

    closeModal() {
      this.resetComposition();
      this.$refs.modalRef?.closeModal();
    },

    // Also what the modal calls once dismissed (`on-close`), since a dismissal
    // closes it without going through closeModal().
    resetComposition() {
      // A drag the closing modal cut short: no dragend will come for it.
      this.handleDragEnd();
      this.accessor = null;
      this.stateAccessor = null;
      this.replacesExistingMarkup = false;
      this.rebuildsMarkup = false;
      this.refusedState = null;
      this.state = emptyState();
      this.selectedId = null;
      this.openedState = '';
    },
  },
  template: MODAL_TEMPLATE,
});

module.exports = { BlockBuilderModalComponent };
