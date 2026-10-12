'use strict';

/**
 * Sanitized previews, keyed on the mailing and its last write. DOMPurify on a
 * whole document costs real CPU, synchronously (about a second per MB), and a
 * preview is opened far more often than it changes. One instance per sanitizer:
 * the editor's preview (mailing.service.js) and the public share page
 * (share-link/share-page.controller.js) apply different rules.
 *
 * Bounded by the total size held, not by a number of entries: previewHtml can
 * weigh up to PREVIEW_HTML_MAX_LENGTH, and twenty of those would be hundreds of
 * MB per worker. Real previews are around 50KB, so the budget holds a few
 * hundred of them; a preview larger than `maxEntry` is sanitized every time
 * instead of evicting everything else. The least recently used go first.
 *
 * @param {Object} options
 * @param {Function} options.sanitize - previewHtml → sanitized html
 * @param {number} [options.budget] - characters held at most
 * @param {number} [options.maxEntry] - largest entry held, a tenth of the
 *   budget unless said otherwise
 */
const DEFAULT_BUDGET = 8 * 1024 * 1024; // characters

function createSanitizedPreviewCache({
  sanitize,
  budget = DEFAULT_BUDGET,
  maxEntry = budget / 10,
}) {
  const entries = new Map();
  let size = 0;

  // A version of the mailing: `save()` and findByIdAndUpdate both bump
  // updatedAt (timestamps), previewHtml itself is not needed to name it.
  const keyOf = (mailing) =>
    `${mailing._id}:${
      mailing.updatedAt ? new Date(mailing.updatedAt).getTime() : 0
    }`;

  function evictOldest() {
    const [oldestKey, oldestHtml] = entries.entries().next().value;
    entries.delete(oldestKey);
    size -= oldestHtml.length;
  }

  /**
   * The sanitized preview of this version when it is held, else undefined:
   * `_id` and `updatedAt` are enough to ask.
   */
  function peek(mailing) {
    const key = keyOf(mailing);
    if (!entries.has(key)) return undefined;
    const html = entries.get(key);
    // Refresh its position: the Map iterates in insertion order, oldest first.
    entries.delete(key);
    entries.set(key, html);
    return html;
  }

  /** The sanitized preview, held for the next time when it fits. */
  function sanitizeCached(mailing) {
    const held = peek(mailing);
    if (held !== undefined) return held;
    const html = sanitize(mailing.previewHtml);
    if (html.length > maxEntry) return html;
    entries.set(keyOf(mailing), html);
    size += html.length;
    while (size > budget) evictOldest();
    return html;
  }

  return { peek, sanitizeCached };
}

module.exports = { createSanitizedPreviewCache };
