'use strict';

// Search, format filter and date sort for a gallery's files.
//
// Shared because both ends filter the same list. The server exposes it on
// GET /images/gallery/:mongoId (US-02); the editor applies it in the browser,
// where the whole gallery already sits in a Knockout observable loaded in one
// request — so searching costs no round-trip, and the grid keeps mirroring the
// one list Mosaico itself mutates on upload and delete.
//
// Keeping a single definition is the point: "jpeg counts as jpg" and
// case-insensitive matching must not drift between the two callers.
//
// Pure, no Node builtins — the editor bundles this through browserify.

const SORT_BY_VALUES = ['date_desc', 'date_asc'];

const normalizeExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext);

// fallback to the epoch so files without an uploadedAt sort as the oldest
const fileDate = (file) =>
  file.uploadedAt ? new Date(file.uploadedAt) : new Date(0);

// an image not yet migrated has no label: its file name is what the user sees,
// so it is also what they will search for
const fileLabel = (file) => file.label || file.name || '';

const fileExt = (file) => {
  const match = /\.([a-z0-9]+)$/i.exec(file.name || '');
  return match ? normalizeExt(match[1].toLowerCase()) : '';
};

/**
 * @param {Array<object>} files gallery files, as the Gallery getter exposes them
 * @param {{search?: string, format?: string, sortBy?: string}} [criteria]
 * @returns {Array<object>} a new array; the input order is kept unless sortBy asks otherwise
 */
function filterGalleryFiles(files, { search, format, sortBy } = {}) {
  let result = [...files];

  // query params can arrive as arrays/objects (e.g. ?search[]=a) — only string
  // values are meaningful for these text comparisons, anything else is ignored
  if (typeof search === 'string' && search.trim()) {
    const needle = search.trim().toLowerCase();
    result = result.filter((f) => fileLabel(f).toLowerCase().includes(needle));
  }

  if (typeof format === 'string' && format) {
    const normalizedFormat = normalizeExt(format.toLowerCase());
    result = result.filter((f) => fileExt(f) === normalizedFormat);
  }

  if (sortBy === 'date_desc') {
    result.sort((a, b) => fileDate(b) - fileDate(a));
  } else if (sortBy === 'date_asc') {
    result.sort((a, b) => fileDate(a) - fileDate(b));
  }

  return result;
}

module.exports = {
  filterGalleryFiles,
  SORT_BY_VALUES,
};
