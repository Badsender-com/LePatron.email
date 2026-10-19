'use strict';

const { nextIndex } = require('./grid-keys.js');

/**
 * The keyboard in the grid. The scroller recycles its views, so DOM order is
 * pool order, not list order, and Tab used to walk the thumbnails out of
 * order. The grid is a single tab stop instead (roving tabindex): one
 * image, the current one, takes Tab along with its action bar; the arrows,
 * Home and End move through the list in its own order (grid-keys.js).
 *
 * The current image is held by name, so it follows its image when the list
 * is filtered, sorted or grows; an image the filter hides leaves its place
 * to the one now there, and is found again when the filter is cleared.
 * Mixed into the panel; reads its `visibleImages`, `count`, `gridColumns`
 * and `pickAt`.
 */
module.exports = {
  data: () => ({
    currentIndex: 0,
    currentName: null,
    // Scrolled away from, the current image has no element to take Tab: the
    // grid itself takes it then, and hands the focus back (onGridFocus).
    // Data, not computed from the range: the range moves with every row
    // scrolled, and each change would re-render every cell of the grid.
    currentRendered: true,
  }),
  created() {
    // the range of images the scroller renders, from its `update` event
    this._rendered = { from: 0, to: 0 };
  },
  watch: {
    currentIndex: 'refreshRendered',
    visibleImages(list) {
      const index = list.findIndex((file) => file.name === this.currentName);
      const samePlace = Math.max(
        Math.min(this.currentIndex, list.length - 1),
        0
      );
      this.currentIndex = index === -1 ? samePlace : index;
    },
  },
  methods: {
    // A click, a delete or a rename can put the focus in a thumbnail too:
    // wherever it lands, that image becomes the tab stop.
    onGridFocusin(event) {
      const index = this.cellIndexOf(event.target);
      if (index === null) return;
      this.currentIndex = index;
      this.currentName = this.visibleImages[index].name;
    },
    // Only from the image control: in the rename field the arrows move the
    // caret, and on an action button they are left to the browser.
    onGridKeydown(event) {
      if (!event.target.matches('[data-gallery-pick]')) return;
      const index = this.cellIndexOf(event.target);
      const next = nextIndex(event.key, index, this.count, this.gridColumns);
      if (next === null) return;
      event.preventDefault();
      this.currentIndex = next;
      this.currentName = this.visibleImages[next].name;
      this.focusCurrent();
    },
    // A click on a label or between the cells focuses the grid as well, the
    // nearest element that takes the focus: no keyboard user arriving there,
    // and bringing the image back would scroll the grid under the pointer.
    // The focus comes between the press and the release; a release outside
    // the grid (a drag onto the email) is never heard, so a press counts
    // for one focus at most.
    onGridPointer(event) {
      this._pointerDown = event.type === 'mousedown';
    },
    onGridFocus(event) {
      const fromPointer = this._pointerDown;
      this._pointerDown = false;
      if (event.target !== event.currentTarget || fromPointer) return;
      this.focusCurrent();
    },
    // A rendered image is focused at once, and the browser scrolls it into
    // view by as little as it needs. One outside the scroller's range has
    // no element yet: scroll to it, and focus it once rendered.
    focusCurrent() {
      const pick = this.pickAt(this.currentIndex);
      if (pick) {
        pick.focus();
        return;
      }
      this._focusPending = true;
      this.$refs.scroller.scrollToItem(this.currentIndex);
    },
    onRendered(from, to) {
      this._rendered = { from, to };
      this.refreshRendered();
      if (this._focusPending) this.$nextTick(this.focusPendingImage);
    },
    refreshRendered() {
      const { from, to } = this._rendered;
      this.currentRendered = this.currentIndex >= from && this.currentIndex < to;
    },
    // Unless the user has put the focus elsewhere meanwhile: it is theirs.
    focusPendingImage() {
      const pick = this.pickAt(this.currentIndex);
      if (!pick) return;
      this._focusPending = false;
      const active = document.activeElement;
      const scroller = this.$refs.scroller.$el;
      if (active && active !== document.body && !scroller.contains(active)) {
        return;
      }
      pick.focus();
    },
    cellIndexOf(element) {
      const cell = element.closest('.gallery-vue-cell');
      return cell ? Number(cell.getAttribute('data-gallery-index')) : null;
    },
  },
};
