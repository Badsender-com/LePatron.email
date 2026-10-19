'use strict';

const { RecycleScroller } = require('vue-virtual-scroller');
const Thumb = require('./thumb');
const Tooltip = require('./tooltip');
const PanelTooltip = require('./panel-tooltip.js');
const PanelActions = require('./panel-actions.js');
const PanelKeyboard = require('./panel-keyboard.js');
const template = require('./panel.template.js');
const {
  filterGalleryFiles,
} = require('../../../../../../shared/gallery/filter.js');
const {
  galleryActions,
  NO_GALLERY_ACTIONS,
} = require('../../../ext/gallery-actions.js');

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

/**
 * The gallery panel, one instance per pane. Its options are static; what
 * belongs to one editor comes from the definition galleryPlugin.js builds
 * around them, read through `$options`:
 *   - `viewModel`: the Mosaico viewModel the panel mirrors and acts through;
 *   - `remembered`: the last search, format and sort of each pane, kept for
 *     as long as this editor is open. Selecting another block closes the
 *     gallery and destroys its panes; reopening it to fill the next image
 *     placeholder is precisely when a search typed for the previous one is
 *     still wanted.
 */
module.exports = {
  components: { Thumb, Tooltip, RecycleScroller },
  mixins: [PanelTooltip, PanelActions, PanelKeyboard],
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
    // what the user may do to this pane's images (ext/gallery-actions.js);
    // mirrored from the Knockout side like `images`, because Vue cannot
    // observe the viewModel's `currentUser`, which is null until it has loaded
    actions: NO_GALLERY_ACTIONS,
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
      return this.t(key, { count: this.count });
    },
    searchPlaceholder() {
      return this.t('gallery-search-placeholder');
    },
    emptyGalleryLabel() {
      return this.t(`gallery-${this.type}-empty`);
    },
    // Three of these carry a `__label__` token the thumbnail substitutes for
    // itself: the bag is computed once for the whole panel, and the accessible
    // name of an icon button has to name the image it acts on.
    thumbStrings() {
      return {
        remove: this.t('gallery-remove-image'),
        editAction: this.t('gallery-edit-action'),
        renameAction: this.t('gallery-rename-action'),
        renameInput: this.t('gallery-rename-input-label'),
      };
    },
    clearSearchLabel() {
      return this.t('gallery-search-clear');
    },
    listLabel() {
      return this.t('gallery-list-label');
    },
    formatGroupLabel() {
      return this.t('gallery-filter-group');
    },
    sortGroupLabel() {
      return this.t('gallery-sort-group');
    },
    // Tell the two dead ends apart: a search that matches nothing reads
    // differently from a format the gallery simply has none of.
    noResultLabel() {
      const key = this.isSearching
        ? 'gallery-search-no-result'
        : 'gallery-filter-no-result';
      return this.t(key);
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
  // Not reactive on purpose: Vue would otherwise walk the whole viewModel.
  beforeCreate() {
    this.viewModel = this.$options.viewModel;
  },
  created() {
    this._subscriptions = [];
    const { knownNames = null, ...criteria } =
      this.$options.remembered[this.type] || {};
    // The names of the gallery as last seen loaded, null until it is: an
    // image missing from them is new, uploaded here or while this pane was
    // closed (on an image of the email).
    this._knownNames = knownNames;
    Object.assign(this, criteria);
  },
  mounted() {
    // Status first: whether the list belongs to a loaded gallery is what
    // tells an upload from the first load of the whole list.
    this.mirror(this.viewModel[this.type + 'GalleryStatus'], (status) => {
      this.status = status;
    });
    // The list stays Mosaico's: upload, delete and rename replace entries of
    // the Knockout observableArray, never edit one in place. A frozen copy,
    // so Vue neither takes over that array nor walks every file to make it
    // reactive. The scroller still makes reactive the few files it shows,
    // which it keeps in its own pool. At 5,000 images under jsdom: 25 ms
    // at opening and 14 ms a keystroke unfrozen, 7 ms and 4 ms frozen.
    this.mirror(this.viewModel[this.type + 'Gallery'], (array) => {
      const known = this._knownNames;
      this.images = Object.freeze(array.slice());
      this._knownNames = this.isLoaded
        ? new Set(array.map((file) => file.name))
        : null;
      if (known) this.reveal(array.filter((file) => !known.has(file.name)));
    });
    // The editor opens before the user is known, and the actions have to
    // appear once it is. Read through the one rule, never the payload.
    this.mirror(this.viewModel.currentUser, () => {
      this.actions = galleryActions(this.viewModel, this.type);
    });
  },
  beforeDestroy() {
    this._subscriptions.forEach((subscription) => subscription.dispose());
    const { search, format, sortBy, _knownNames: knownNames } = this;
    this.$options.remembered[this.type] = {
      search,
      format,
      sortBy,
      knownNames,
    };
  },
  methods: {
    t(key, params) {
      return this.viewModel.t(key, params);
    },
    // Vue cannot observe a Knockout observable: read it now, then on change.
    mirror(observable, assign) {
      if (!observable) return;
      assign(observable());
      if (typeof observable.subscribe === 'function') {
        this._subscriptions.push(observable.subscribe(assign));
      }
    },
    // The search and format outlive the block they were typed for, so an
    // image uploaded under them could be hidden at once: no thumbnail, an
    // unchanged count, an upload that reads as failed. A filter that would
    // hide a new image is cleared, the sort kept: it hides nothing.
    reveal(arrivals) {
      const { search, format } = this;
      const shown = filterGalleryFiles(arrivals, { search, format });
      if (shown.length === arrivals.length) return;
      this.search = '';
      this.format = '';
    },
    formatLabel(format) {
      return this.t(format ? `gallery-filter-${format}` : 'gallery-filter-all');
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
      return this.t(`gallery-sort-${this.sortKey(sortBy)}`);
    },
    sortTitle(sortBy) {
      const explanation = this.t(`gallery-sort-${this.sortKey(sortBy)}-title`);
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
