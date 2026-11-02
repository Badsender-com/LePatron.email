'use strict';

jest.mock('node-fetch');
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  writeStreamFromStream: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../packages/server/common/upload-identity.service.js', () => ({
  // the shared reader, which bounds what it hands the prober
  probeImageDimensions: jest.fn().mockReturnValue(null),
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
const uploadIdentity = require('../../../packages/server/common/upload-identity.service.js');
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

// A gallery that holds what is pushed into it, so the service can read back
// the image it answers with.
function galleryHoldingPushes() {
  const files = [];
  Galleries.updateOne.mockImplementation((_query, update) => {
    files.push(update.$push.files);
    return Promise.resolve({ nModified: 1 });
  });
  Galleries.findOne.mockResolvedValue({ files });
}

describe('image.service.createFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    galleryHoldingPushes();
  });

  it('runs the SSRF guard on the image URL before downloading', async () => {
    mockImageResponse(Buffer.from('imagedata'));

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

  // The download is measured through the shared reader, never handed whole to
  // the prober: the reader is what bounds the prefix the prober sees.
  it('measures the download through the shared reader, not the raw buffer', async () => {
    mockImageResponse(Buffer.from('imagedata'));
    uploadIdentity.probeImageDimensions.mockReturnValue({
      width: 640,
      height: 480,
    });

    const result = await imageService.createFromUrl(MONGO_ID, IMAGE_URL);

    expect(uploadIdentity.probeImageDimensions).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ width: 640, height: 480 });
  });

  it('stores the image and appends it to the gallery', async () => {
    mockImageResponse(Buffer.from('imagedata'));

    const result = await imageService.createFromUrl(MONGO_ID, IMAGE_URL);

    expect(fileManager.writeStreamFromStream).toHaveBeenCalledTimes(1);
    expect(result.name).toMatch(new RegExp(`^${MONGO_ID}-[a-f0-9]+\\.png$`));
    // createFromUrl answers with the image as the gallery holds it
    expect(result).toMatchObject({
      label: 'photo.png',
      source: 'upload',
      externalMetadata: {},
      uploadedAt: expect.any(Date),
    });
    expect(Galleries.updateOne).toHaveBeenCalledWith(
      { creationOrWireframeId: MONGO_ID, 'files.name': { $ne: result.name } },
      { $push: { files: result } }
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
