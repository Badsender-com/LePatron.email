'use strict';

jest.mock('node-fetch');
jest.mock('../../../packages/server/utils/outbound-host.js', () => ({
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  writeStreamFromStream: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Galleries: {
    findOne: jest.fn(),
  },
}));
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
    const save = jest.fn().mockResolvedValue(undefined);
    Galleries.findOne.mockResolvedValue({
      files: [],
      markModified: jest.fn(),
      save,
    });

    const result = await imageService.createFromUrl(MONGO_ID, IMAGE_URL);

    expect(fileManager.writeStreamFromStream).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.name).toMatch(new RegExp(`^${MONGO_ID}-[a-f0-9]+\\.png$`));
  });

  it('does not duplicate an image already present in the gallery', async () => {
    const buffer = Buffer.from('imagedata');
    mockImageResponse(buffer);
    // Pre-compute the deterministic filename the service will derive.
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const fileName = `${MONGO_ID}-${hash}.png`;

    const save = jest.fn().mockResolvedValue(undefined);
    Galleries.findOne.mockResolvedValue({
      files: [{ name: fileName }],
      markModified: jest.fn(),
      save,
    });

    await imageService.createFromUrl(MONGO_ID, IMAGE_URL);
    expect(save).not.toHaveBeenCalled();
  });
});
