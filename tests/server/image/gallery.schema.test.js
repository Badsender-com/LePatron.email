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

// loaded for the Schema() call it makes, captured above
require('../../../packages/server/image/gallery.schema');

describe('gallery.schema — files getter', () => {
  let getter;

  beforeAll(() => {
    getter = capturedFilesDefinition.get;
  });

  describe('Mosaico fields (required for compatibility)', () => {
    it('keeps the four Mosaico fields of every file', () => {
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
    it('returns the label when there is one (migrated image or new upload)', () => {
      const result = getter([{ name: 'abc-hash.jpg', label: 'mon-logo.jpg' }]);
      expect(result[0].label).toBe('mon-logo.jpg');
    });

    it('falls back to the file name without a label (image not yet migrated)', () => {
      const result = getter([{ name: 'abc-hash.jpg' }]);
      expect(result[0].label).toBe('abc-hash.jpg');
    });
  });

  describe('uploadedAt', () => {
    // the date sort reads this through the getter: drop it here and sorting
    // silently falls back to the epoch for every image
    it('returns the upload date when there is one', () => {
      const uploadedAt = new Date('2026-02-01');
      const result = getter([{ name: 'f.jpg', uploadedAt }]);
      expect(result[0].uploadedAt).toBe(uploadedAt);
    });

    it('falls back to null (image not yet migrated)', () => {
      const result = getter([{ name: 'f.jpg' }]);
      expect(result[0].uploadedAt).toBeNull();
    });
  });

  describe('source', () => {
    it('returns the source when there is one', () => {
      const result = getter([{ name: 'f.jpg', source: 'dam_bynder' }]);
      expect(result[0].source).toBe('dam_bynder');
    });

    it('falls back to "upload" without a source', () => {
      const result = getter([{ name: 'f.jpg' }]);
      expect(result[0].source).toBe('upload');
    });
  });

  describe('externalMetadata', () => {
    it('returns the external metadata when there are some', () => {
      const result = getter([
        { name: 'f.jpg', externalMetadata: { foo: 'bar' } },
      ]);
      expect(result[0].externalMetadata).toEqual({ foo: 'bar' });
    });

    it('falls back to {} without external metadata', () => {
      const result = getter([{ name: 'f.jpg' }]);
      expect(result[0].externalMetadata).toEqual({});
    });
  });

  describe('dimensions', () => {
    it('returns the original width and height when they are known', () => {
      const result = getter([{ name: 'f.jpg', width: 600, height: 400 }]);
      expect(result[0]).toMatchObject({ width: 600, height: 400 });
    });

    it('falls back to null when they are not', () => {
      const result = getter([{ name: 'f.jpg' }]);
      expect(result[0]).toMatchObject({ width: null, height: null });
    });
  });
});
