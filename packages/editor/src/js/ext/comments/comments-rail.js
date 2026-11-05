'use strict';

/**
 * The comment markers rail (ADR 0020): beside the email, in the canvas, a
 * marker on each block that has unresolved comments, at the height of the
 * block. It stays in Knockout while the comments panel moves to Vue, and reads
 * the comments' state through what it is given: the counts per block, the
 * target of a new comment (its active marker), how to open the comments on a
 * block.
 *
 * Placed from the email actually shown, not from a guessed width: beside the
 * email's right edge, whatever the preview, the width of the window or the
 * panels open, and never past the visible canvas.
 */

// Throttle of the scroll updates, about one frame.
const SCROLL_THROTTLE_MS = 16;
const MARKER_HEIGHT = 28;
// Room kept below the canvas for the bottom bar.
const BOTTOM_BAR = 60;
const RAIL_GAP = 8;
// The widest marker, active (scaled) and with a two-digit count.
const RAIL_WIDTH = 52;
// What moves the email without a scroll: the window resized, the canvas
// sliding when a panel opens (watchSize: a preview switched).
const LAYOUT_EVENTS = ['resize', 'transitionend'];
// The canvas, whose `right` slides when a right panel opens or closes.
const CANVAS_ID = 'main-edit-area';

// A count is `{ count, maxSeverity }`, or a bare number from older answers.
const countOf = (data) => (typeof data === 'object' ? data.count : data);
const severityOf = (data) =>
  (typeof data === 'object' && data.maxSeverity) || 'info';
// Comments on the whole email have no block, and no marker.
const isBlockId = (id) => Boolean(id) && id !== 'null' && id !== 'undefined';

/**
 * @param {Object} ko - knockout
 * @param {Object} options
 * @param {Function} options.counts - observable, `{ [blockId]: count }`
 * @param {Function} options.target - observable, the block id of a new
 *   comment, or null for the whole email
 * @param {Function} options.openForBlock - opens the comments on a block
 * @param {Function} options.labelOf - the label of a block, by its id
 * @param {Function} options.scroller - the scrolling canvas, or null
 * @param {Window} [options.window]
 */
function createCommentsRail(
  ko,
  { counts, target, openForBlock, labelOf, scroller, window: win = window }
) {
  const positions = ko.observable({});
  const left = ko.observable(null);
  let listened = null;
  let pending = null;

  const blockIds = () =>
    Object.keys(counts()).filter(
      (id) => isBlockId(id) && countOf(counts()[id]) > 0
    );

  // Where each block with comments is, and whether its marker is on screen.
  function measure(container) {
    const topBar =
      parseInt(
        win
          .getComputedStyle(win.document.documentElement)
          .getPropertyValue('--top-bar-height'),
        10
      ) || 40;
    const visibleHeight = win.innerHeight - BOTTOM_BAR - topBar;
    // Matched by attribute, never put into a selector: a block id comes from
    // stored comments.
    const elements = {};
    container.querySelectorAll('.editable[data-block-id]').forEach((el) => {
      elements[el.getAttribute('data-block-id')] = el;
    });
    const next = {};
    blockIds().forEach((id) => {
      const block = elements[id];
      if (!block) return;
      const rect = block.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - topBar;
      next[id] = {
        top: center,
        visible:
          center + MARKER_HEIGHT / 2 > 0 &&
          center - MARKER_HEIGHT / 2 < visibleHeight,
      };
    });
    positions(next);
    left(railLeft(container));
    watchSize(container);
  }

  // The email's content grew or shrank, or a preview switched: its size
  // changes with no scroll nor resize of the window. Only while the page is
  // drawn; the editor also places the rail on a preview switch.
  let sizeObserver = null;
  function watchSize(container) {
    if (sizeObserver || typeof win.ResizeObserver !== 'function') return;
    const email = container.querySelector('replacedbody');
    if (!email) return;
    sizeObserver = new win.ResizeObserver(() => onScroll());
    sizeObserver.observe(email);
  }

  // Beside the email shown, kept inside the canvas.
  function railLeft(container) {
    const email = container.querySelector('replacedbody');
    if (!email || !email.getBoundingClientRect) return null;
    // The canvas's visible right edge, its scrollbar left out.
    const canvasRight =
      container.getBoundingClientRect().left + container.clientWidth;
    const emailRight = email.getBoundingClientRect().right;
    if (!canvasRight && !emailRight) return null;
    return Math.min(emailRight + RAIL_GAP, canvasRight - RAIL_WIDTH);
  }

  // The canvas has finished sliding, not some other element: the rail's own
  // move, a marker, a block of the email.
  function onLayout(event) {
    if (event.type === 'transitionend' && event.target.id !== CANVAS_ID) return;
    onScroll();
  }

  function onScroll() {
    if (pending) return;
    pending = win.setTimeout(() => {
      pending = null;
      update();
    }, SCROLL_THROTTLE_MS);
  }

  function update() {
    const container = scroller();
    if (!container) return;
    if (listened !== container) {
      if (listened) listened.removeEventListener('scroll', onScroll);
      else LAYOUT_EVENTS.forEach((type) => win.addEventListener(type, onLayout));
      container.addEventListener('scroll', onScroll);
      listened = container;
    }
    measure(container);
  }

  // One marker per block, kept from a measure to the next: the rail's buttons
  // are not rendered again on each scroll, and keep the focus. Its values are
  // updated in place; `view` tells the template.
  const byBlock = new Map();
  function markerOf(id) {
    if (!byBlock.has(id)) {
      byBlock.set(id, { blockId: id, label: labelOf(id), view: ko.observable() });
    }
    return byBlock.get(id);
  }

  const markers = ko.pureComputed(() => {
    const all = counts();
    const where = positions();
    const active = target();
    return blockIds()
      .filter((id) => where[id] && where[id].visible)
      .map((id) => {
        const marker = Object.assign(markerOf(id), {
          position: where[id].top,
          count: countOf(all[id]),
          maxSeverity: severityOf(all[id]),
          active: active === id,
        });
        marker.view({
          position: marker.position,
          count: marker.count,
          maxSeverity: marker.maxSeverity,
          active: marker.active,
        });
        return marker;
      })
      .sort((a, b) => a.position - b.position);
  });

  const visible = ko.pureComputed(() => blockIds().length > 0);

  // New counts may bring blocks not measured yet.
  const countsSubscription = counts.subscribe(() => update());

  return {
    visible,
    markers,
    left,
    update,
    open(marker) {
      openForBlock(marker.blockId);
    },
    dispose() {
      countsSubscription.dispose();
      if (pending) win.clearTimeout(pending);
      pending = null;
      if (listened) listened.removeEventListener('scroll', onScroll);
      LAYOUT_EVENTS.forEach((type) => win.removeEventListener(type, onLayout));
      listened = null;
      if (sizeObserver) sizeObserver.disconnect();
      sizeObserver = null;
    },
  };
}

module.exports = { createCommentsRail };
