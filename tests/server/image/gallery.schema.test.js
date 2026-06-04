'use strict';

// Capture the `files` field definition from the Schema() call to test the getter in isolation.
// The getter is a pure function (files[]) → transformed files[], no DB needed.
let capturedFilesDefinition = null;

jest.mock('mongoose', () => {
  const mockSchema = jest.fn((definition) => {
    capturedFilesDefinition = definition.files;
    return { plugin: jest.fn(), methods: {} };
  });
  mockSchema.Types = { ObjectId: jest.fn() };
  return { Schema: mockSchema, Types: { ObjectId: jest.fn() } };
});
// mongoose-hidden is required as: require('mongoose-hidden')() → plugin fn
jest.mock('mongoose-hidden', () => () => jest.fn());

const GallerySchema = require('../../../packages/server/image/gallery.schema');

describe('gallery.schema — files getter', () => {
  let getter;

  beforeAll(() => {
    getter = capturedFilesDefinition.get;
  });

  describe('champs Mosaico (compat obligatoire)', () => {
    it('préserve les 4 champs Mosaico dans chaque fichier', () => {
      const result = getter([{ name: 'abc-hash.jpg' }]);
      expect(result[0]).toMatchObject({
        name: 'abc-hash.jpg',
        url: 'abc-hash.jpg',
        deleteUrl: '/api/images/abc-hash.jpg',
        thumbnailUrl: '/api/images/cover/111x111/abc-hash.jpg',
      });
    });
  });

  describe('label', () => {
    it('retourne file.label quand il est défini (image migrée ou nouvel upload)', () => {
      const result = getter([{ name: 'abc-hash.jpg', label: 'mon-logo.jpg' }]);
      expect(result[0].label).toBe('mon-logo.jpg');
    });

    it('retourne file.name comme fallback quand label absent (images non encore migrées)', () => {
      const result = getter([{ name: 'abc-hash.jpg' }]);
      expect(result[0].label).toBe('abc-hash.jpg');
    });
  });

  describe('source', () => {
    it('retourne file.source quand il est défini', () => {
      const result = getter([{ name: 'f.jpg', source: 'dam_bynder' }]);
      expect(result[0].source).toBe('dam_bynder');
    });

    it('retourne "upload" comme fallback quand source absent', () => {
      const result = getter([{ name: 'f.jpg' }]);
      expect(result[0].source).toBe('upload');
    });
  });

  describe('externalMetadata', () => {
    it('retourne file.externalMetadata quand il est défini', () => {
      const result = getter([
        { name: 'f.jpg', externalMetadata: { foo: 'bar' } },
      ]);
      expect(result[0].externalMetadata).toEqual({ foo: 'bar' });
    });

    it('retourne {} comme fallback quand externalMetadata absent', () => {
      const result = getter([{ name: 'f.jpg' }]);
      expect(result[0].externalMetadata).toEqual({});
    });
  });
});

describe('gallery.schema — duplicate()', () => {
  const OLD_ID = '507f1f77bcf86cd799439011';
  const NEW_ID = '507f1f77bcf86cd799439022';

  function makeMockDoc(files) {
    return {
      _id: 'some-id',
      isNew: false,
      creationOrWireframeId: OLD_ID,
      files,
      markModified: jest.fn(),
    };
  }

  it('ne plante pas quand externalMetadata est un objet (régression)', () => {
    const doc = makeMockDoc([
      {
        name: `${OLD_ID}-hash.jpg`,
        url: `${OLD_ID}-hash.jpg`,
        deleteUrl: `/api/images/${OLD_ID}-hash.jpg`,
        thumbnailUrl: `/api/images/cover/111x111/${OLD_ID}-hash.jpg`,
        label: 'mon-logo.jpg',
        source: 'upload',
        externalMetadata: { foo: 'bar' },
      },
    ]);

    expect(() =>
      GallerySchema.methods.duplicate.call(doc, NEW_ID)
    ).not.toThrow();
  });

  it('remplace l\'ancien creationId dans les champs string', () => {
    const doc = makeMockDoc([
      {
        name: `${OLD_ID}-hash.jpg`,
        url: `${OLD_ID}-hash.jpg`,
        deleteUrl: `/api/images/${OLD_ID}-hash.jpg`,
        thumbnailUrl: `/api/images/cover/111x111/${OLD_ID}-hash.jpg`,
        label: 'logo.jpg',
        source: 'upload',
        externalMetadata: {},
      },
    ]);

    GallerySchema.methods.duplicate.call(doc, NEW_ID);

    expect(doc.files[0].name).toBe(`${NEW_ID}-hash.jpg`);
    expect(doc.files[0].url).toBe(`${NEW_ID}-hash.jpg`);
    expect(doc.files[0].deleteUrl).toBe(`/api/images/${NEW_ID}-hash.jpg`);
  });

  it('ne modifie pas label et externalMetadata (pas d\'ancien creationId dedans)', () => {
    const doc = makeMockDoc([
      {
        name: `${OLD_ID}-hash.jpg`,
        url: `${OLD_ID}-hash.jpg`,
        deleteUrl: `/api/images/${OLD_ID}-hash.jpg`,
        thumbnailUrl: `/api/images/cover/111x111/${OLD_ID}-hash.jpg`,
        label: 'logo.jpg',
        source: 'upload',
        externalMetadata: { provider: 'bynder' },
      },
    ]);

    GallerySchema.methods.duplicate.call(doc, NEW_ID);

    expect(doc.files[0].label).toBe('logo.jpg');
    expect(doc.files[0].externalMetadata).toEqual({ provider: 'bynder' });
  });
});
