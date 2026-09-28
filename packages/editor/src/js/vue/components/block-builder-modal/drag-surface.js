'use strict';

const {
  DRAGGING_CLASS,
  DROP_BEFORE_CLASS,
  DROP_AFTER_CLASS,
  MOVING_CLASS,
} = require('./preview-surface.js');
const {
  ELEMENT_ATTRIBUTE,
} = require('../../../../../../shared/block-builder/generate.js');

// Dragging an element from the palette into the preview.
//
// A mixin for the same reason the preview is one: every method here reads or
// writes the component's state — what is being dragged, where it would land,
// whether a render is being held back.
//
// It depends on the preview surface and not the other way round: the preview
// owns the iframe, its stylesheet and the class names; this adds a gesture on
// top of it. `previewDocument`, `previewRows` and `renderPreview` come from
// there.

const DragSurfaceMixin = {
  methods: {
    /** True while either kind of drag is under way. */
    isDragging() {
      return Boolean(this.draggingType || this.draggingId);
    },

    // The drag carries its type in `dataTransfer` as well as in component
    // state. The state is what the drop reads — both ends are ours — but
    // `setData` is not optional: without it Firefox never starts the drag.
    //
    // THE EVENT MUST NOT REACH `window`. Mosaico installs listeners there that
    // cancel `dragstart` and `drag` outright (template-loader.js
    // `fixPageEvents`, called from app.js), so that the browser's native drag
    // cannot fight the jQuery UI sortable driving the canvas. That protection
    // is right for the rest of the page and wrong for this palette, which is
    // the one place a native drag is wanted — so the event is stopped here
    // rather than the protection weakened there.
    handleDragStart(type, event) {
      event.stopPropagation();
      this.draggingType = type;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', type);
      }
      const doc = this.previewDocument();
      if (doc && doc.body) doc.body.classList.add(DRAGGING_CLASS);
    },

    // `drag` fires continuously at the source for the whole gesture, and
    // cancelling it cancels the drop — so Mosaico's window listener has to be
    // kept away from this one too, not just from `dragstart`.
    handleDrag(event) {
      event.stopPropagation();
    },

    // Dragging a row that is already in the block moves it. Same indicator,
    // same drop maths as an insertion — only what happens on drop differs.
    handlePreviewDragStart(event) {
      const doc = this.previewDocument();
      const target = event.target;
      const row =
        target && typeof target.closest === 'function'
          ? target.closest(`[${ELEMENT_ATTRIBUTE}]`)
          : null;

      if (!row || !doc) return;

      const id = row.getAttribute(ELEMENT_ATTRIBUTE);
      if (!this.state.elements.some((element) => element.id === id)) return;

      this.draggingId = id;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
      }
      // Selecting what is being moved, so the settings panel follows the thing
      // under the cursor rather than staying on whatever was selected before.
      this.selectedId = id;
      row.classList.add(MOVING_CLASS);
      doc.body.classList.add(DRAGGING_CLASS);
    },

    handleDragEnd() {
      this.draggingType = null;
      this.draggingId = null;
      this.dropIndex = null;
      this.clearDropIndicator();
      const doc = this.previewDocument();
      if (doc && doc.body) {
        doc.body.classList.remove(DRAGGING_CLASS);
        this.previewRows(doc).forEach((row) =>
          row.classList.remove(MOVING_CLASS)
        );
      }
      // Renders were held while the rows had to stay still under the cursor.
      if (this.renderHeldDuringDrag) {
        this.renderHeldDuringDrag = false;
        this.renderPreview();
      }
    },

    handlePreviewDragOver(event) {
      if (!this.isDragging()) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = this.draggingId ? 'move' : 'copy';
      }

      const doc = this.previewDocument();
      if (!doc || !doc.body) return;
      doc.body.classList.add(DRAGGING_CLASS);

      this.dropIndex = this.dropIndexAt(doc, event.clientY);
      this.showDropIndicator(doc, this.dropIndex);
    },

    // Leaving the iframe entirely, rather than crossing between two rows:
    // `relatedTarget` is null (or outside the document) only for the former.
    //
    // Firefox leaves `relatedTarget` null on `dragleave` more often than that,
    // so crossing a row boundary there clears the indicator — and the very next
    // `dragover` puts it back. A frame of flicker at worst; doing better means
    // counting enters and leaves, which is its own source of stuck state.
    handlePreviewDragLeave(event) {
      const leaving = event.relatedTarget;
      const doc = this.previewDocument();
      if (!doc) return;
      if (leaving && doc.contains(leaving)) return;
      this.dropIndex = null;
      this.clearDropIndicator();
    },

    handlePreviewDrop(event) {
      if (!this.isDragging()) return;
      event.preventDefault();

      const doc = this.previewDocument();
      const index = doc ? this.dropIndexAt(doc, event.clientY) : 0;
      const type = this.draggingType;
      const id = this.draggingId;

      this.handleDragEnd();

      if (id) this.moveElementTo(id, index);
      else this.insertElement(type, index);
    },

    /**
     * Moves an element to the position the cursor was over.
     *
     * `index` counts rows as they are laid out NOW, with the dragged element
     * still among them. Taking it out first shifts everything after it up by
     * one, so a target past its old position has to come down by one — the
     * classic off-by-one of every reorder, and the reason dropping an element
     * just below itself would otherwise move it one row too far.
     */
    moveElementTo(id, index) {
      const from = this.state.elements.findIndex(
        (element) => element.id === id
      );
      if (from === -1) return;

      const to = index > from ? index - 1 : index;
      if (to === from) return;

      const [element] = this.state.elements.splice(from, 1);
      this.state.elements.splice(to, 0, element);
      this.selectedId = element.id;
    },

    /**
     * Where an element dropped at this height would go.
     *
     * Measured against each row's midpoint: above it the element goes before,
     * below it after. Past the last row, at the end.
     *
     * @returns {number} an index in `state.elements`
     */
    dropIndexAt(doc, clientY) {
      const rows = this.previewRows(doc);
      for (let i = 0; i < rows.length; i++) {
        const box = rows[i].getBoundingClientRect();
        if (clientY < box.top + box.height / 2) return i;
      }
      return rows.length;
    },

    showDropIndicator(doc, index) {
      const rows = this.previewRows(doc);
      this.clearDropIndicator();
      if (!rows.length) return;

      if (index < rows.length) {
        rows[index].classList.add(DROP_BEFORE_CLASS);
      } else {
        rows[rows.length - 1].classList.add(DROP_AFTER_CLASS);
      }
    },

    clearDropIndicator() {
      this.previewRows(this.previewDocument()).forEach((row) => {
        row.classList.remove(DROP_BEFORE_CLASS);
        row.classList.remove(DROP_AFTER_CLASS);
      });
    },
  },
};

module.exports = { DragSurfaceMixin };
