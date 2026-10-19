'use strict';

const stream = require('stream');

// The native sharp binary is not installed for every dev platform, and these
// tests only need the pipeline's shape, not real pixels.
jest.mock('sharp', () => {
  const { PassThrough } = require('stream');
  const makePipeline = () => {
    const pipeline = new PassThrough();
    pipeline.resize = jest.fn(() => pipeline);
    pipeline.png = jest.fn(() => pipeline);
    pipeline.clone = jest.fn(() => new PassThrough());
    return pipeline;
  };
  return jest.fn(() => makePipeline());
});

jest.mock('probe-image-size', () => {
  const probe = jest.fn();
  probe.sync = jest.fn();
  return probe;
});
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  streamImage: jest.fn(),
  writeStreamFromStream: jest.fn().mockResolvedValue(undefined),
  streamImageFromPreviews: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common.js', () => {
  // used both as a model (findOne) and as a constructor (cache bookkeeping)
  const CacheImages = jest.fn(() => ({
    save: jest.fn().mockResolvedValue(undefined),
  }));
  CacheImages.findOne = jest.fn();
  return { CacheImages, Galleries: { findOne: jest.fn() } };
});
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
}));
jest.mock('../../../packages/server/image/image.service.js', () => ({
  createGallery: jest.fn(),
  createFromUrl: jest.fn(),
}));

const sharp = require('sharp');
const probe = require('probe-image-size');
const fileManager = require('../../../packages/server/common/file-manage.service.js');
const images = require('../../../packages/server/image/image.controller.js');

const PNG_BYTES = Buffer.from('\x89PNG\r\n\x1a\n-not-a-real-png', 'binary');

function sourceStream(bytes = PNG_BYTES) {
  const readable = new stream.PassThrough();
  readable.end(bytes);
  return readable;
}

function fakeResponse() {
  const res = new stream.PassThrough();
  res.set = jest.fn();
  res.headersSent = false;
  return res;
}

// Waits for the response to be fully written: streamImageToResponse is async
// (it may probe the payload first), so the assertions can't run synchronously.
function whenFinished(res) {
  return new Promise((resolve) => res.on('end', resolve));
}

describe('image.controller — read()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileManager.streamImage.mockImplementation(() => sourceStream());
  });

  it('serves the sniffed type when the extension is not an image one', async () => {
    // production has gallery files named `.bin` and `.false` that are PNGs
    probe.mockResolvedValue({ mime: 'image/png', type: 'png' });
    const res = fakeResponse();

    images.read({ params: { imageName: 'a-b.bin' } }, res, jest.fn());
    res.resume();
    await whenFinished(res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.set).not.toHaveBeenCalledWith(
      'Content-Type',
      'application/octet-stream'
    );
  });

  it('trusts an image extension without re-reading the file', async () => {
    const res = fakeResponse();

    images.read({ params: { imageName: 'a-b.png' } }, res, jest.fn());
    res.resume();
    await whenFinished(res);

    expect(probe).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(fileManager.streamImage).toHaveBeenCalledTimes(1);
  });

  it('falls back to the extension guess when the bytes are not an image', async () => {
    probe.mockRejectedValue(new Error('unrecognized format'));
    const res = fakeResponse();

    images.read({ params: { imageName: 'a-b.bin' } }, res, jest.fn());
    res.resume();
    await whenFinished(res);

    expect(res.set).toHaveBeenCalledWith(
      'Content-Type',
      'application/octet-stream'
    );
  });
});

describe('image.controller — cover()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileManager.streamImage.mockImplementation(() => sourceStream());
  });

  it('rasterizes an SVG source and announces PNG', () => {
    // sharp has no SVG encoder: checkSizes announced `image/svg+xml` from the
    // source, but the payload is a PNG. Saying so is what stops the browser
    // from dropping the image and retrying forever.
    const res = fakeResponse();
    const req = {
      path: '/cover/330xnull/a-b.svg',
      params: { sizes: '330xnull', imageName: 'a-b.svg' },
      imageDatas: { type: 'svg', mime: 'image/svg+xml', width: 660 },
    };

    images.cover(req, res, jest.fn());

    const pipeline = sharp.mock.results[0].value;
    expect(pipeline.png).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('leaves a raster source untouched', () => {
    const res = fakeResponse();
    const req = {
      path: '/cover/176xnull/a-b.bin',
      params: { sizes: '176xnull', imageName: 'a-b.bin' },
      imageDatas: { type: 'png', mime: 'image/png', width: 700 },
    };

    images.cover(req, res, jest.fn());

    const pipeline = sharp.mock.results[0].value;
    expect(pipeline.png).not.toHaveBeenCalled();
    expect(res.set).not.toHaveBeenCalledWith('Content-Type', 'image/png');
  });
});
