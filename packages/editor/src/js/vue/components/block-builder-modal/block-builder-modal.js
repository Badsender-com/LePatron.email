const Vue = require('vue/dist/vue.common');
const { ModalComponent } = require('../modal/modalComponent');
const {
  ElementSettingsComponent,
  LABEL_KEYS,
  STARTERS,
} = require('./element-settings');
const { PreviewSurfaceMixin } = require('./preview-surface.js');
const { ElementListMixin } = require('./element-list.js');
const { DismissalMixin } = require('./dismissal.js');
const { DragSurfaceMixin } = require('./drag-surface.js');
const { ColumnTargetMixin } = require('./column-target.js');
const { PageGuardMixin } = require('./page-guard.js');
const { RowSettingsMixin } = require('./row-settings.js');
const { RowSpacingMixin } = require('./row-spacing-settings.js');
const { RowActionsMixin } = require('./row-actions.js');
const { RowDragMixin } = require('./row-drag.js');
const { SelectionMixin } = require('./selection.js');
const MODAL_TEMPLATE = require('./modal-template.js');
const {
  validateBlockBuilderLength,
} = require('../../../ext/synthetic-blocks/validate.js');
const {
  generate,
  emptyState,
} = require('../../../../../../shared/block-builder/generate.js');
const {
  parseState,
  serialiseState,
} = require('../../../../../../shared/block-builder/state.js');
const {
  elementsOfState,
  isWritableComposition,
} = require('../../../../../../shared/block-builder/composition.js');

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
  // drag-surface.js, column-target.js for the column it aims at, and
  // page-guard.js for the editor page around it. And Escape or a backdrop
  // click ask before losing work — see dismissal.js.
  // What is selected is one state of its own — see selection.js. A row's
  // structure is row-settings.js, the space between its columns
  // row-spacing-settings.js, moving one is row-actions.js, and dragging one in
  // the list row-drag.js.
  mixins: [
    SelectionMixin,
    PreviewSurfaceMixin,
    ElementListMixin,
    DragSurfaceMixin,
    ColumnTargetMixin,
    PageGuardMixin,
    RowSettingsMixin,
    RowSpacingMixin,
    RowActionsMixin,
    RowDragMixin,
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
    // The serialised state an apply was refused for: too large, or more rows
    // than a stored composition is read with. Kept rather than a boolean so
    // the message goes as soon as the composition changes.
    refusedState: null,
    state: emptyState(),
    previewWidth: DESKTOP_WIDTH,
    desktopWidth: DESKTOP_WIDTH,
    mobileWidth: MOBILE_WIDTH,
  }),
  // The column the list works on, and the selected element, come with the
  // selection: see selection.js.
  computed: {
    // What the block will actually store and mail: no element ids, which are
    // editing chrome and have no business in a recipient's inbox.
    html() {
      return generate(this.state);
    },

    // What the preview renders. Same markup plus the ids the selection and the
    // drag need, the columns the drag aims at — empty rows included, so a row
    // just added can be seen and filled — and the greyed starter of each
    // element still blank. None of which leaves this iframe.
    previewMarkup() {
      return generate(this.state, {
        elementIds: true,
        chrome: true,
        starters: this.previewStarters,
      });
    },
    // The words a blank element shows, plus an image with no source: no words
    // for that one, only the mark — the preview draws an empty frame for it.
    previewStarters() {
      return Object.keys(STARTERS).reduce(
        (starters, type) => {
          const { key, labelKey } = STARTERS[type];
          starters[type] = { key, text: this.vm.t(labelKey) };
          return starters;
        },
        { image: { key: 'src' } }
      );
    },
    // The whole composition, not the active column: an empty column beside
    // content is not an empty block.
    isEmpty() {
      return elementsOfState(this.state).length === 0;
    },
    refused() {
      return (
        this.refusedState !== null &&
        this.refusedState === serialiseState(this.state)
      );
    },
    // One reason shown at a time: the rows first, since cutting rows down is
    // also what makes the composition smaller.
    tooManyRows() {
      return this.refused && !isWritableComposition(this.state);
    },
    tooLarge() {
      return this.refused && !this.tooManyRows;
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
    selectedElementId() {
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
      const [first] = elementsOfState(this.state);
      this.selectElement(first ? first.id : null);
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
      // down: applied, it would make every autosave fail on the server — too
      // large, or with more rows than the read accepts, which the server
      // reports as unreadable and a reopening would lose.
      if (
        !isWritableComposition(this.state) ||
        !validateBlockBuilderLength(html, state).valid
      ) {
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
      this.selectElement(null);
      this.openedState = '';
    },
  },
  template: MODAL_TEMPLATE,
});

module.exports = { BlockBuilderModalComponent };
