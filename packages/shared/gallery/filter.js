'use strict';

// Search, format filter and date sort for a gallery's files.
//
// The editor applies it in the browser, where the whole gallery already sits
// in a Knockout observable loaded in one request (GET /images/gallery/:mongoId
// answers every image) — so searching costs no round-trip, and the grid keeps
// mirroring the one list Mosaico itself mutates on upload and delete.
//
// In packages/shared next to the label rules, so that what the gallery
// matches, and how it names images, is defined in one place.
//
// Pure, no Node builtins — the editor bundles this through browserify.

const SORT_BY_VALUES = ['date_desc', 'date_asc'];

const normalizeExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext);

// A file without a readable uploadedAt sorts as the oldest: missing, or a
// string `Date` cannot read, which would otherwise compare as NaN and leave
// the order of the whole sort to chance.
const fileTime = (file) => {
  const time = file.uploadedAt ? new Date(file.uploadedAt).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

// Each date is read once, not once per comparison: the editor sorts on every
// keystroke of its search box, from JSON where every date is a string to
// parse, and n log n parses of a 5,000-image gallery cost tens of
// milliseconds a keystroke. The sort is stable, so equal dates keep the
// given order.
function sortByDate(files, direction) {
  return files
    .map((file) => ({ file, time: fileTime(file) }))
    .sort((a, b) => direction * (a.time - b.time))
    .map((entry) => entry.file);
}

// an image not yet migrated has no label: its file name is what the user sees,
// so it is also what they will search for
const fileLabel = (file) => file.label || file.name || '';

// macOS stores file names decomposed (NFD): in "çaé" the cedilla and the acute
// are separate combining marks, while a search box produces the composed form
// (NFC). The two render identically and compare unequal, so a file literally
// named "çaé.png" could not be found by typing "çaé".
//
// Stripping the marks rather than just composing them also makes the search
// accent-insensitive, which is what a French user expects from a search box:
// "separateur" finds "séparateur". The Combining Diacritical Marks block is
// used explicitly instead of \p{Diacritic}, which the editor's older browser
// targets do not all support.
const foldForSearch = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const fileExt = (file) => {
  const match = /\.([a-z0-9]+)$/i.exec(file.name || '');
  return match ? normalizeExt(match[1].toLowerCase()) : '';
};

// The image editor flattens whatever it opens: an animated GIF comes back as a
// single still frame, and an SVG is rasterised. So those two are not offered to
// it — the thumbnail hides its edit button (US-08) and the edit extension
// refuses the action (US-10). One predicate, so the two cannot drift apart and
// leave a button that does nothing: editing an unchanged image re-uploads
// identical bytes, which the content-addressed name turns into a silent no-op.
const NON_EDITABLE_FORMATS = ['gif', 'svg'];

const isEditableImage = (file) => !NON_EDITABLE_FORMATS.includes(fileExt(file));

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
    const needle = foldForSearch(search.trim());
    result = result.filter((f) => foldForSearch(fileLabel(f)).includes(needle));
  }

  if (typeof format === 'string' && format) {
    const normalizedFormat = normalizeExt(format.toLowerCase());
    result = result.filter((f) => fileExt(f) === normalizedFormat);
  }

  if (sortBy === 'date_desc') return sortByDate(result, -1);
  if (sortBy === 'date_asc') return sortByDate(result, 1);

  return result;
}

module.exports = {
  filterGalleryFiles,
  fileExt,
  isEditableImage,
  SORT_BY_VALUES,
};
