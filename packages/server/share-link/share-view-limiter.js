'use strict';

/**
 * Views of the public page (share-page.controller.js), per fixed window, at
 * two levels: per reader of a link, so that one reader cannot lock the link
 * for the others, and per link, so that a link passed around cannot be
 * hammered from many addresses at once. In memory: each worker counts on its
 * own.
 *
 * Keys come from requests, so each table is bounded, and never cleared as a
 * whole: past the bound, expired windows go first, then the oldest windows
 * still under their limit, so that a flood of new keys cannot reset a reader
 * who reached it. Only a table full of exhausted windows drops those, oldest
 * first.
 */

function fixedWindows({ windowMs, max, maxEntries }) {
  // Insertion order is window order: a window is re-inserted when it starts,
  // so the expired ones are always at the front.
  const windows = new Map();

  function prune(at) {
    for (const [key, entry] of windows) {
      if (entry.resetAt > at) break;
      windows.delete(key);
    }
    for (const [key, entry] of windows) {
      if (windows.size < maxEntries) return;
      if (entry.count < max) windows.delete(key);
    }
    for (const key of windows.keys()) {
      if (windows.size < maxEntries) return;
      windows.delete(key);
    }
  }

  /** @returns {number} seconds before the key may go again, 0 to go ahead */
  function hit(key, at) {
    let entry = windows.get(key);
    if (!entry || entry.resetAt <= at) {
      windows.delete(key);
      if (windows.size >= maxEntries) prune(at);
      entry = { count: 0, resetAt: at + windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;
    if (entry.count <= max) return 0;
    return Math.ceil((entry.resetAt - at) / 1000);
  }

  return { hit, size: () => windows.size };
}

function createShareViewLimiter({
  windowMs,
  maxPerReader,
  maxPerLink,
  maxEntries,
}) {
  const readers = fixedWindows({ windowMs, max: maxPerReader, maxEntries });
  const links = fixedWindows({ windowMs, max: maxPerLink, maxEntries });

  return {
    /**
     * A blocked reader's views do not count for the link: one reader past
     * its limit must not use up the others' share.
     * @returns {number} seconds before the next view is allowed, 0 to go ahead
     */
    blockedFor(linkId, reader, at = Date.now()) {
      const readerWait = readers.hit(`${linkId}|${reader}`, at);
      if (readerWait > 0) return readerWait;
      return links.hit(String(linkId), at);
    },
    size: () => ({ readers: readers.size(), links: links.size() }),
  };
}

module.exports = { createShareViewLimiter };
