'use strict';

/**
 * What the gallery metadata backfill has to do, and the writes that do it:
 * pure, testable without a database or a storage backend.
 */

// 0 is not a dimension an image can have, and the tooltip would print "0 × 0".
const MISSING_DIMENSION = { $in: [null, 0] };
const LACKS_DIMENSIONS = [
  { width: MISSING_DIMENSION },
  { height: MISSING_DIMENSION },
];
// `null` in a query matches a missing field as well as a null one.
const LACKS_DATE = { uploadedAt: null };

function needsDimensions(file) {
  return !file.width || !file.height;
}

function needsDate(file) {
  return file.uploadedAt === undefined || file.uploadedAt === null;
}

/**
 * @param {Array<object>} files as stored
 * @returns {{pending: Map<*, object>, known: number}} the names to read, with
 *   how many entries carry each, and how many of them lack their dimensions
 *   (`unsized`) or their date (`undated`); legacy galleries can list a name
 *   twice
 */
function planGalleryBackfill(files) {
  const pending = new Map();
  let known = 0;
  for (const file of files) {
    const unsized = needsDimensions(file) ? 1 : 0;
    const undated = needsDate(file) ? 1 : 0;
    if (unsized + undated === 0) {
      known += 1;
      continue;
    }
    const need = pending.get(file.name) || {
      entries: 0,
      unsized: 0,
      undated: 0,
    };
    need.entries += 1;
    need.unsized += unsized;
    need.undated += undated;
    pending.set(file.name, need);
  }
  return { pending, known };
}

// Each field is written under its own precondition, so a value written
// meanwhile (an upload, another run) is left alone and the write not counted;
// on every entry of that name.
function buildDimensionsUpdate(galleryId, name, { width, height }) {
  return {
    filter: {
      _id: galleryId,
      files: { $elemMatch: { name, $or: LACKS_DIMENSIONS } },
    },
    update: {
      $set: { 'files.$[file].width': width, 'files.$[file].height': height },
    },
    options: {
      arrayFilters: [
        {
          'file.name': name,
          $or: [
            { 'file.width': MISSING_DIMENSION },
            { 'file.height': MISSING_DIMENSION },
          ],
        },
      ],
    },
  };
}

function buildDateUpdate(galleryId, name, storedAt) {
  return {
    filter: { _id: galleryId, files: { $elemMatch: { name, ...LACKS_DATE } } },
    update: { $set: { 'files.$[file].uploadedAt': storedAt } },
    options: {
      arrayFilters: [{ 'file.name': name, 'file.uploadedAt': null }],
    },
  };
}

module.exports = {
  needsDimensions,
  needsDate,
  planGalleryBackfill,
  buildDimensionsUpdate,
  buildDateUpdate,
  LACKS_DIMENSIONS,
  LACKS_DATE,
};
