'use strict';

const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const { RecycleScroller } = require('vue-virtual-scroller');
const { galleryBridge } = require('../ext/badsender-gallery-bridge');
const Thumb = require('./components/gallery/thumb');
const Tooltip = require('./components/gallery/tooltip');
const createGalleryDraggable = require('./directives/gallery-draggable');
const template = require('./components/gallery/panel.template.js');
const {
  filterGalleryFiles,
} = require('../../../../shared/gallery/filter.js');

// Fixed cell size for the virtualised grid. The gallery sidebar has a fixed
// usable width (~364px), so 3 columns of 118px fit with margin to spare.
const GRID_COLUMNS = 3;
const CELL_SIZE = 118;

// Format chips. '' is "Tous" — the neutral state, like the mockup's first chip.
const FORMATS = ['', 'jpg', 'png', 'gif'];

// Sort chips. No neutral state: on a gallery filled one image at a time — the
// only way a real one is filled — the order Mosaico loads is already newest
// first, so a "default" chip would have duplicated this one while reading as
// something else. Sorting explicitly also makes the order deterministic rather
// than dependent on insertion order in the document.
const SORTS = ['date_desc', 'date_asc'];

// Built from the Mosaico viewModel rather than declared inline, so a test can
// drive the real component options instead of a copy of them.
function createGalleryPanel(vm) {
  return {
    components: { Thumb, Tooltip, RecycleScroller },
    directives: { galleryDraggable: createGalleryDraggable(vm) },
  props: {
    // 'mailing' or 'template' — one instance per gallery pane
    type: { type: String, required: true },
  },
  data: () => ({
    images: [],
    search: '',
    format: '',
    sortBy: 'date_desc',
    // the single tooltip this panel owns, and what it currently describes
    hoveredFile: null,
    hoveredAnchor: null,
    panelBounds: null,
    // copied per instance: a module-level array put straight into data() is
    // observed once by Vue and then shared by both panels (mailing, template)
    formats: [...FORMATS],
    sorts: [...SORTS],
    cellSize: CELL_SIZE,
    gridColumns: GRID_COLUMNS,
  }),
  computed: {
    // `images` stays the untouched mirror of the Knockout observable —
    // Mosaico keeps mutating that one on upload and delete. Searching only
    // derives from it, so a filter can never desynchronise the grid from
    // the list the rest of the editor works with. One call carries every
    // criterion, so search, format and sort cannot disagree about how they
    // combine.
    visibleImages() {
      return filterGalleryFiles(this.images, {
        search: this.search,
        format: this.format,
        sortBy: this.sortBy,
      });
    },
    count() {
      return this.visibleImages.length;
    },
    isSearching() {
      return this.search.trim() !== '';
    },
    isFiltering() {
      return this.isSearching || this.format !== '';
    },
    hasNoResult() {
      return this.isFiltering && this.count === 0;
    },
    // A gallery with nothing in it is not a filter that matched nothing, and
    // the panel has to say so rather than show an unexplained blank.
    isEmptyGallery() {
      return !this.isFiltering && this.images.length === 0;
    },
    // Nothing to search or filter through until the gallery holds something —
    // the toolbar would otherwise sit above the "Load gallery" button.
    showToolbar() {
      return this.images.length > 0 || this.isFiltering;
    },
    countLabel() {
      const key =
        this.count === 1 ? 'gallery-image-count-one' : 'gallery-image-count';
      return vm.t(key, { count: this.count });
    },
    searchPlaceholder() {
      return vm.t('gallery-search-placeholder');
    },
    emptyGalleryLabel() {
      return vm.t(`gallery-${this.type}-empty`);
    },
    // handed down to each thumbnail so the component needs no viewModel of
    // its own; computed once rather than per cell
    tooltipStrings() {
      return {
        // a translation entry whose value is a locale tag, so the date follows
        // the editor's language rather than the browser's
        locale: vm.t('gallery-date-locale'),
        dimensions: vm.t('gallery-tooltip-dimensions'),
        format: vm.t('gallery-tooltip-format'),
        uploadedAt: vm.t('gallery-tooltip-uploaded-at'),
      };
    },
    thumbStrings() {
      return {
        remove: vm.t('gallery-remove-image'),
        renameAction: vm.t('gallery-rename-action'),
        renameInput: vm.t('gallery-rename-input-label'),
      };
    },
    clearSearchLabel() {
      return vm.t('gallery-search-clear');
    },
    formatGroupLabel() {
      return vm.t('gallery-filter-group');
    },
    sortGroupLabel() {
      return vm.t('gallery-sort-group');
    },
    // Tell the two dead ends apart: a search that matches nothing reads
    // differently from a format the gallery simply has none of.
    noResultLabel() {
      const key = this.isSearching
        ? 'gallery-search-no-result'
        : 'gallery-filter-no-result';
      return vm.t(key);
    },
  },
  watch: {
    // The scroller keeps its scrollTop when the list shrinks: scrolled deep
    // into 500 images, then filtering down to three, the viewport would sit
    // past the end of the content and the grid would read as empty while the
    // counter said "3 images". Watches the criteria rather than the result, so
    // an upload arriving under an active filter does not yank the user back.
    search: 'resetScroll',
    format: 'resetScroll',
    sortBy: 'resetScroll',
    // Chrome fires no mouseleave on an element removed from the DOM, so
    // deleting the hovered image left its tooltip on screen describing a file
    // that no longer exists.
    visibleImages(images) {
      if (!this.hoveredFile) return;
      if (!images.some((file) => file.name === this.hoveredFile.name)) {
        this.onUnhover();
      }
    },
  },
  created() {
    this._subscription = null;
    this._hoverTimer = null;
  },
  mounted() {
    // Mirror the Knockout observableArray into Vue reactive data. Vue
    // cannot observe KO observables directly, so we snapshot + subscribe.
    const observable = vm[this.type + 'Gallery'];
    if (observable) {
      this.images = observable().slice();
      this._subscription = observable.subscribe((array) => {
        this.images = array.slice();
      });
    }
    galleryBridge.ready();
  },
  beforeDestroy() {
    if (this._subscription) this._subscription.dispose();
    this.cancelHover();
  },
  methods: {
    // ISO with the previous grid: click replaces the selected email image
    onSelect(file) {
      vm.addImage(file);
    },
    // ISO with the previous grid: delete the image from the gallery
    onRemove(file) {
      vm.removeImage(file, this.type);
    },
    // The rename writes into the Knockout observable, not into this mirror:
    // that array is what the rest of the editor reads, so the optimistic
    // update has to land there and flow back through the subscription.
    onRename(file, label) {
      vm.renameImage(file, this.type, label).then((saved) => {
        if (saved) vm.notifier.success(vm.t('gallery-rename-image-success'));
      });
    },
    // the thumbnail refused the input before it ever reached the server
    onRenameRejected(messageKey) {
      vm.notifier.error(vm.t(messageKey));
    },
    // A delay, so sweeping across the grid on the way somewhere else does not
    // flash a tooltip over every cell on the path.
    onHover(file, element) {
      this.cancelHover();
      this._hoverTimer = setTimeout(() => {
        // the scroller may have recycled this cell away during the delay
        if (!element.isConnected) return;
        this.hoveredFile = file;
        this.hoveredAnchor = element.getBoundingClientRect();
        this.panelBounds = this.$el.getBoundingClientRect();
      }, Tooltip.OPEN_DELAY_MS);
    },
    // Immediate on leave: a tooltip that lingers covers what the pointer is
    // heading for.
    onUnhover() {
      this.cancelHover();
      this.hoveredFile = null;
      this.hoveredAnchor = null;
    },
    cancelHover() {
      if (this._hoverTimer) clearTimeout(this._hoverTimer);
      this._hoverTimer = null;
    },
    formatLabel(format) {
      return vm.t(format ? `gallery-filter-${format}` : 'gallery-filter-all');
    },
    sortKey(sortBy) {
      return sortBy === 'date_desc' ? 'newest' : 'oldest';
    },
    // The chip stays compact; the arrow alone is quicker to scan than a
    // sentence but slower to decode, so the sentence follows it in the tooltip
    // and in the accessible name. That name is built from the visible label
    // rather than translated whole: an accessible name that does not contain
    // the visible text fails WCAG 2.5.3, and a voice-control user saying
    // "Date" would match nothing.
    sortLabel(sortBy) {
      return vm.t(`gallery-sort-${this.sortKey(sortBy)}`);
    },
    sortTitle(sortBy) {
      const explanation = vm.t(`gallery-sort-${this.sortKey(sortBy)}-title`);
      return `${this.sortLabel(sortBy)} — ${explanation}`;
    },
    resetScroll() {
      this.$nextTick(() => {
        const scroller = this.$refs.scroller;
        if (scroller && scroller.scrollToPosition) scroller.scrollToPosition(0);
      });
    },
    clearSearch() {
      this.search = '';
      // give the field back to the user: clearing is usually a retry
      this.$nextTick(() => {
        if (this.$refs.searchInput) this.$refs.searchInput.focus();
      });
    },
  },
  template,
  };
}

module.exports = {
  viewModel(vm, ko) {
    // Expose the bridge to Knockout (mirrors badsender-events-hub's
    // `vm.bsEventsHub`) so KO-side code can dispatch GALLERY_REFRESH and
    // listen to GALLERY_IMAGE_SELECTED.
    vm.galleryBridge = galleryBridge;
  },
  init(vm) {
    const GalleryPanel = createGalleryPanel(vm);

    ko.bindingHandlers.vueGalleryPanel = {
      init(element, valueAccessor) {
        const type = ko.unwrap(valueAccessor());
        const mountPoint = document.createElement('div');
        element.appendChild(mountPoint);
        const instance = new Vue({
          render: (h) => h(GalleryPanel, { props: { type } }),
        }).$mount(mountPoint);
        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
          instance.$destroy();
        });
        return { controlsDescendantBindings: true };
      },
    };
  },
  createGalleryPanel,
};
