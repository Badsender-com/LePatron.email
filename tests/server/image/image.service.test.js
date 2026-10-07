'use strict';

jest.mock('node-fetch');
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  writeStreamFromStream: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../packages/server/common/models.common.js', () => {
  // a constructor (createGallery does `new Galleries()`) with the statics used
  const Galleries = jest.fn();
  Galleries.findOne = jest.fn();
  Galleries.updateOne = jest.fn();
  Galleries.findOneAndUpdate = jest.fn();
  return { Galleries };
});
jest.mock(
  '../../../packages/server/helpers/format-filename-for-jquery-fileupload.js',
  () => (name) => ({ name, url: `/img/${name}` })
);

const fetch = require('node-fetch');
const imageService = require('../../../packages/server/image/image.service.js');
const {
  assertOutboundHostAllowed,
} = require('../../../packages/server/utils/outbound-host.js');
const fileManager = require('../../../packages/server/common/file-manage.service.js');
const {
  Galleries,
} = require('../../../packages/server/common/models.common.js');

const MONGO_ID = 'abc123';
const IMAGE_URL = 'https://cdn.example.com/photo.png';

function mockImageResponse(
  buffer,
  { ok = true, status = 200, contentType = 'image/png' } = {}
) {
  fetch.mockResolvedValue({
    ok,
    status,
    headers: { get: () => contentType },
    buffer: () => Promise.resolve(buffer),
  });
}

describe('image.service.createFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the SSRF guard on the image URL before downloading', async () => {
    mockImageResponse(Buffer.from('imagedata'));
    Galleries.findOne.mockResolvedValue({
      files: [],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    });

    await imageService.createFromUrl(MONGO_ID, IMAGE_URL);
    expect(assertOutboundHostAllowed).toHaveBeenCalledWith(IMAGE_URL);
  });

  it('does not fetch when the SSRF guard rejects', async () => {
    assertOutboundHostAllowed.mockRejectedValueOnce(new Error('blocked'));
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow('blocked');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws on a non-ok download', async () => {
    mockImageResponse(Buffer.from(''), { ok: false, status: 500 });
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow();
  });

  it('rejects an empty image', async () => {
    mockImageResponse(Buffer.alloc(0));
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow('empty');
  });

  it('rejects an image over the size cap', async () => {
    mockImageResponse(Buffer.alloc(10 * 1024 * 1024 + 1));
    await expect(
      imageService.createFromUrl(MONGO_ID, IMAGE_URL)
    ).rejects.toThrow(/size/i);
  });

  it('stores the image and appends it to the gallery', async () => {
    mockImageResponse(Buffer.from('imagedata'));
    Galleries.findOne.mockResolvedValue({ files: [] });

    const result = await imageService.createFromUrl(MONGO_ID, IMAGE_URL);

    expect(fileManager.writeStreamFromStream).toHaveBeenCalledTimes(1);
    expect(result.name).toMatch(new RegExp(`^${MONGO_ID}-[a-f0-9]+\\.png$`));
    expect(Galleries.updateOne).toHaveBeenCalledWith(
      { creationOrWireframeId: MONGO_ID, 'files.name': { $ne: result.name } },
      {
        $push: {
          files: {
            ...result,
            label: result.name,
            source: 'upload',
            externalMetadata: {},
            uploadedAt: expect.any(Date),
          },
        },
      }
    );
  });
});

describe('image.service.addFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Uploads validated one after the other overlap on the server. Reading the
  // gallery and saving it back made every overlapping save but one fail with a
  // VersionError, and those images never reached the gallery.
  it('appends each file in one atomic update, never by saving a read gallery', async () => {
    const save = jest.fn();
    Galleries.findOne.mockResolvedValue({ files: [], save });
    const files = [
      { name: `${MONGO_ID}-a.png` },
      { name: `${MONGO_ID}-b.png` },
    ];

    await imageService.addFiles(MONGO_ID, files);

    expect(save).not.toHaveBeenCalled();
    expect(Galleries.updateOne).toHaveBeenCalledTimes(2);
    files.forEach((file) =>
      expect(Galleries.updateOne).toHaveBeenCalledWith(
        // the name filter skips a file the gallery already lists
        { creationOrWireframeId: MONGO_ID, 'files.name': { $ne: file.name } },
        {
          $push: {
            files: {
              ...file,
              // a gallery image carries a user-facing label, its origin and
              // room for a future DAM's metadata (US-01)
              label: file.name,
              source: 'upload',
              externalMetadata: {},
              uploadedAt: expect.any(Date),
            },
          },
        }
      )
    );
  });

  it('creates the gallery first when the creation has none yet', async () => {
    Galleries.findOne.mockResolvedValue(null);
    const save = jest.fn().mockResolvedValue({ files: [] });
    Galleries.mockImplementation(() => ({ save }));

    await imageService.addFiles(MONGO_ID, [{ name: `${MONGO_ID}-a.png` }]);

    expect(save).toHaveBeenCalledTimes(1);
    expect(Galleries.updateOne).toHaveBeenCalledTimes(1);
  });
});

describe('image.service.findOrCreateGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // the first uploads of a creation all find no gallery and all try to create
  // it: the unique index lets one through, the others must use its gallery
  it('uses the gallery another request created in the meantime', async () => {
    const createdMeanwhile = { files: [{ name: `${MONGO_ID}-a.png` }] };
    Galleries.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdMeanwhile);
    const duplicateKey = Object.assign(new Error('E11000'), { code: 11000 });
    Galleries.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(duplicateKey),
    }));

    await expect(imageService.findOrCreateGallery(MONGO_ID)).resolves.toBe(
      createdMeanwhile
    );
  });

  it('lets any other creation error through', async () => {
    Galleries.findOne.mockResolvedValue(null);
    Galleries.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(new Error('db down')),
    }));

    await expect(imageService.findOrCreateGallery(MONGO_ID)).rejects.toThrow(
      'db down'
    );
  });
});

describe('image.service.destroy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pulls the image by name in one atomic update', async () => {
    const gallery = { files: [] };
    Galleries.findOneAndUpdate.mockResolvedValue(gallery);

    await expect(
      imageService.destroy(MONGO_ID, `${MONGO_ID}-a.png`)
    ).resolves.toBe(gallery);
    expect(Galleries.findOneAndUpdate).toHaveBeenCalledWith(
      { creationOrWireframeId: MONGO_ID },
      { $pull: { files: { name: `${MONGO_ID}-a.png` } } },
      { new: true }
    );
  });

  it('answers NotFound when the creation has no gallery', async () => {
    Galleries.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      imageService.destroy(MONGO_ID, `${MONGO_ID}-a.png`)
    ).rejects.toMatchObject({ status: 404 });
  });
});
