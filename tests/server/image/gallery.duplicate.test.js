'use strict';

// duplicate() on a real Mongoose document, no database: what the copy would
// persist is read with the getter off, the way save() writes it.

const mongoose = require('mongoose');

const GallerySchema = require('../../../packages/server/image/gallery.schema.js');

const Gallery = mongoose.model('GalleryDuplicateTest', GallerySchema);

const OLD_ID = '507f1f77bcf86cd799439011';
const NEW_ID = '507f1f77bcf86cd799439022';

const jqueryFields = (id) => ({
  name: `${id}-hash.jpg`,
  url: `${id}-hash.jpg`,
  deleteUrl: `/api/images/${id}-hash.jpg`,
  thumbnailUrl: `/api/images/cover/111x111/${id}-hash.jpg`,
});

function duplicateOf(files) {
  const gallery = new Gallery({ creationOrWireframeId: OLD_ID, files });
  gallery.duplicate(NEW_ID);
  return gallery.get('files', null, { getters: false });
}

describe('gallery.schema — duplicate()', () => {
  it('moves every stored name and url to the new id', () => {
    const [copy] = duplicateOf([jqueryFields(OLD_ID)]);

    expect(copy).toEqual(jqueryFields(NEW_ID));
  });

  it('copies what an image stores, and nothing the getter makes up', () => {
    // an image from before the V1 fields: no label, no date, no dimensions
    const [copy] = duplicateOf([{ name: `${OLD_ID}-hash.jpg` }]);

    expect(copy).toEqual({ name: `${NEW_ID}-hash.jpg` });
  });

  it('keeps the V1 fields of a migrated image as they are', () => {
    const uploadedAt = new Date('2026-01-01T00:00:00Z');
    const [copy] = duplicateOf([
      {
        ...jqueryFields(OLD_ID),
        label: 'logo.jpg',
        source: 'upload',
        externalMetadata: { provider: 'bynder' },
        uploadedAt,
        width: 600,
        height: 400,
      },
    ]);

    expect(copy).toEqual({
      ...jqueryFields(NEW_ID),
      label: 'logo.jpg',
      source: 'upload',
      externalMetadata: { provider: 'bynder' },
      uploadedAt,
      width: 600,
      height: 400,
    });
  });

  it('leaves the original files untouched', () => {
    const original = { name: `${OLD_ID}-hash.jpg`, label: 'logo.jpg' };

    duplicateOf([original]);

    expect(original).toEqual({ name: `${OLD_ID}-hash.jpg`, label: 'logo.jpg' });
  });

  it('becomes a new document of the new parent', () => {
    const gallery = new Gallery({ creationOrWireframeId: OLD_ID, files: [] });
    const oldDocumentId = String(gallery._id);

    gallery.duplicate(NEW_ID);

    expect(gallery.isNew).toBe(true);
    expect(String(gallery._id)).not.toBe(oldDocumentId);
    expect(String(gallery.creationOrWireframeId)).toBe(NEW_ID);
  });
});
