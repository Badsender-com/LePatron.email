'use strict';

// What the gallery's calls share: listing, renaming, deleting, and reading a
// stored image back to edit it.

// Without a ceiling, a stalled connection leaves the panel on "loading…" or
// a label waiting for an answer that never comes, with nothing said. One
// budget, so the four calls cannot drift apart.
const GALLERY_REQUEST_TIMEOUT_MS = 15000;

module.exports = { GALLERY_REQUEST_TIMEOUT_MS };
