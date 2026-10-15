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
  const entries = new Map(); // key -> { html, sourceLength }
  let size = 0;

  // A version of the mailing: `save()` and findByIdAndUpdate both bump
  // updatedAt (timestamps), previewHtml itself is not needed to name it.
  const keyOf = (mailing) =>
    `${mailing._id}:${
      mailing.updatedAt ? new Date(mailing.updatedAt).getTime() : 0
    }`;

  function drop(key) {
    size -= entries.get(key).html.length;
    entries.delete(key);
  }

  /**
   * The sanitized preview of this version when it is held, else undefined:
   * `_id` and `updatedAt` are enough to ask. When previewHtml is given, its
   * length must match too: two writes within the same millisecond (a
   * translated copy, then its preview) share an updatedAt.
   */
  function peek(mailing) {
    const key = keyOf(mailing);
    const held = entries.get(key);
    if (!held) return undefined;
    if (
      typeof mailing.previewHtml === 'string' &&
      mailing.previewHtml.length !== held.sourceLength
    ) {
      return undefined;
    }
    // Refresh its position: the Map iterates in insertion order, oldest first.
    entries.delete(key);
    entries.set(key, held);
    return held.html;
  }

  /** The sanitized preview, held for the next time when it fits. */
  function sanitizeCached(mailing) {
    const cached = peek(mailing);
    if (cached !== undefined) return cached;
    const html = sanitize(mailing.previewHtml);
    const key = keyOf(mailing);
    if (entries.has(key)) drop(key);
    if (html.length > maxEntry) return html;
    entries.set(key, { html, sourceLength: mailing.previewHtml.length });
    size += html.length;
    while (size > budget) drop(entries.keys().next().value);
    return html;
  }

  return { peek, sanitizeCached };
}

module.exports = { createSanitizedPreviewCache };
