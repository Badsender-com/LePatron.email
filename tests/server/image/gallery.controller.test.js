'use strict';

jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  parseMultipart: jest.fn(),
}));
jest.mock('../../../packages/server/image/image.service.js', () => ({
  storeInGallery: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({}));

const fileManager = require('../../../packages/server/common/file-manage.service.js');
const imageService = require('../../../packages/server/image/image.service.js');
const gallery = require('../../../packages/server/image/gallery.controller.js');

describe('gallery.controller — create()', () => {
  // A new gallery is seeded from the storage listing: the upload's bytes must
  // not be in it yet, or the image is seeded under its technical name.
  it('parses the upload once the gallery exists, and answers what it holds', async () => {
    const steps = [];
    const stored = [{ name: 'a.png', label: 'A.png' }];
    imageService.storeInGallery.mockImplementation(async (_id, write) => {
      steps.push('gallery');
      await write();
      return stored;
    });
    fileManager.parseMultipart.mockImplementation(async () => {
      steps.push('upload');
      return { files: [{ name: 'a.png' }] };
    });
    const res = { json: jest.fn() };

    await new Promise((resolve) => {
      res.json.mockImplementation(resolve);
      gallery.create({ params: { mongoId: 'abc' } }, res, resolve);
    });

    expect(steps).toEqual(['gallery', 'upload']);
    expect(res.json).toHaveBeenCalledWith({ files: stored });
  });
});
