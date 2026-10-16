'use strict';

const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const { RecycleScroller } = require('vue-virtual-scroller');
const Thumb = require('./components/gallery/thumb');
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
    components: { Thumb, RecycleScroller },
    directives: { galleryDraggable: createGalleryDraggable(vm) },
  props: {
    // 'mailing' or 'template' — one instance per gallery pane
    type: { type: String, required: true },
  },
  data: () => ({
    images: [],
    // Mosaico's `<type>GalleryStatus`: false until loaded (or after a failed
    // load), 'loading' while the list is fetched, then the image count. The
    // Knockout pane shows the first two states (load button, loading text);
    // the panel takes over once it is a number.
    status: false,
    search: '',
    format: '',
    sortBy: 'date_desc',
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
    // An empty list means nothing before the gallery is loaded: neither a
    // count of 0 nor an empty gallery.
    isLoaded() {
      return typeof this.status === 'number';
    },
    hasNoResult() {
      return this.isFiltering && this.count === 0;
    },
    // A gallery with nothing in it is not a filter that matched nothing, and
    // the panel has to say so rather than show an unexplained blank.
    isEmptyGallery() {
      return this.isLoaded && !this.isFiltering && this.images.length === 0;
    },
    // Nothing to search or filter through until the gallery holds something —
    // the toolbar would otherwise sit above the "Load gallery" button.
    showToolbar() {
      return this.isLoaded && (this.images.length > 0 || this.isFiltering);
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
  },
  created() {
    this._subscriptions = [];
  },
  mounted() {
    // The list stays Mosaico's: upload and delete keep mutating the Knockout
    // observableArray. A copy, so Vue does not take over that array.
    this.mirror(vm[this.type + 'Gallery'], (array) => {
      this.images = array.slice();
    });
    this.mirror(vm[this.type + 'GalleryStatus'], (status) => {
      this.status = status;
    });
  },
  beforeDestroy() {
    this._subscriptions.forEach((subscription) => subscription.dispose());
  },
  methods: {
    // Vue cannot observe a Knockout observable: read it now, then on change.
    mirror(observable, assign) {
      if (!observable) return;
      assign(observable());
      this._subscriptions.push(observable.subscribe(assign));
    },
    // ISO with the previous grid: click replaces the selected email image
    onSelect(file) {
      vm.addImage(file);
    },
    // ISO with the previous grid: delete the image from the gallery
    onRemove(file) {
      vm.removeImage(file, this.type);
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

// One panel definition per Mosaico viewModel, built when the first pane of
// that editor mounts.
const panels = new WeakMap();
function panelFor(vm) {
  if (!panels.has(vm)) panels.set(vm, createGalleryPanel(vm));
  return panels.get(vm);
}

// Registered when the module loads, like the bindings of ko-bindings.js, so it
// exists before Mosaico applies its bindings, whether or not the gallery is
// open at that point. The viewModel is the root of the binding context.
ko.bindingHandlers.vueGalleryPanel = {
  init(element, valueAccessor, allBindings, data, bindingContext) {
    const type = ko.unwrap(valueAccessor());
    const GalleryPanel = panelFor(bindingContext.$root);
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

module.exports = { createGalleryPanel };
