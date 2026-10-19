'use strict';

/**
 * In-memory stand-ins for the `Galleries` model and the image storage.
 *
 * The gallery writes are single atomic updates whose outcome depends on what
 * the collection and the storage already hold: a gallery is seeded from the
 * storage listing, and a push is skipped when the name is already there. A
 * `jest.fn()` per call cannot show what ends up stored; these fakes keep the
 * documents and answer the queries the service runs the way MongoDB would:
 * the unique index on `creationOrWireframeId`, the `$ne` name filter of a
 * push, the `$elemMatch` projection of a read.
 *
 * Documents are hydrated through the real gallery schema, so what a test
 * reads back went through the same `files` getter as an API response.
 */

const mongoose = require('mongoose');
const GallerySchema = require('../../packages/server/image/gallery.schema.js');

const DUPLICATE_KEY_ERROR = 11000;

let Model;
function galleryModel() {
  if (!Model) Model = mongoose.model('FakeGallery', GallerySchema);
  return Model;
}

const clone = (value) => JSON.parse(JSON.stringify(value));

function createFakeGalleries() {
  const documents = new Map();
  const keyOf = (id) => String(id);

  function hydrate(stored, files) {
    return galleryModel().hydrate({ ...stored, files });
  }

  const Galleries = jest.fn((doc) => ({
    save: jest.fn(async () => {
      const key = keyOf(doc.creationOrWireframeId);
      if (documents.has(key)) {
        throw Object.assign(new Error('E11000'), { code: DUPLICATE_KEY_ERROR });
      }
      documents.set(key, clone(doc));
      return hydrate(documents.get(key), documents.get(key).files);
    }),
  }));

  Galleries.findOne = jest.fn(async (query, projection) => {
    const stored = documents.get(keyOf(query.creationOrWireframeId));
    if (!stored) return null;
    const wanted =
      projection && projection.files && projection.files.$elemMatch;
    const files = wanted
      ? stored.files.filter((file) => file.name === wanted.name).slice(0, 1)
      : stored.files;
    return hydrate(stored, clone(files));
  });

  Galleries.updateOne = jest.fn(async (query, update) => {
    const stored = documents.get(keyOf(query.creationOrWireframeId));
    const skipped = query['files.name'] && query['files.name'].$ne;
    if (!stored || stored.files.some((file) => file.name === skipped)) {
      return { n: 0, nModified: 0 };
    }
    stored.files.push(clone(update.$push.files));
    return { n: 1, nModified: 1 };
  });

  return {
    Galleries,
    // what the collection holds, as stored, without the getter's fallbacks
    storedFiles: (id) => (documents.get(keyOf(id)) || { files: [] }).files,
    seed: (id, files) =>
      documents.set(keyOf(id), { creationOrWireframeId: id, files }),
  };
}

// The storage lists by prefix whatever was written, like storage-local and
// storage-s3: a file is listed as soon as its bytes are stored.
function createFakeStorage(formatName) {
  const names = [];
  return {
    write: (name) => names.push(name),
    list: jest.fn(async (prefix) =>
      names.filter((name) => name.startsWith(prefix)).map(formatName)
    ),
  };
}

module.exports = { createFakeGalleries, createFakeStorage };
