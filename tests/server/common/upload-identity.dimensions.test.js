'use strict';

const probe = require('probe-image-size');
const {
  probeImageDimensions,
  SNIFF_BYTES,
  JPEG_SNIFF_BYTES,
} = require('../../../packages/server/common/upload-identity.service.js');

// A JPEG keeps its dimensions in SOF0, which sits after APP1 — and a camera
// fills APP1 with an EXIF thumbnail. 65533 is the largest a segment can
// declare, its length field being two bytes.
function jpeg(appSize, width = 800, height = 600) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (appSize >> 8) & 0xff, appSize & 0xff]),
    Buffer.alloc(appSize - 2),
  ]);
  const sof0 = Buffer.from([
    0xff,
    0xc0,
    0,
    0x11,
    8,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ]);
  return Buffer.concat([soi, app1, sof0]);
}

function png(width, height) {
  const header = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0,
    0,
    0,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52,
  ]);
  const size = Buffer.alloc(8);
  size.writeUInt32BE(width, 0);
  size.writeUInt32BE(height, 4);
  return Buffer.concat([header, size, Buffer.alloc(64)]);
}

describe('probeImageDimensions — what it measures', () => {
  it('measures a PNG from its first bytes', () => {
    expect(probeImageDimensions(png(1200, 800))).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it('measures a JPEG whose dimensions sit right after a small APP1', () => {
    expect(probeImageDimensions(jpeg(1024))).toEqual({
      width: 800,
      height: 600,
    });
  });

  // The whole point of widening the window: 4096 bytes recognise the format,
  // they do not reach SOF0 on a photo out of a camera.
  it('measures a JPEG behind a maximal EXIF segment', () => {
    expect(probeImageDimensions(jpeg(65533))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('gives up rather than reading further on an unusually deep SOF0', () => {
    const deep = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.alloc(200 * 1024),
      jpeg(2).subarray(6),
    ]);
    expect(probeImageDimensions(deep)).toBeNull();
  });
});

describe('probeImageDimensions — what it refuses', () => {
  it('answers null for anything that is not an image', () => {
    expect(probeImageDimensions(Buffer.from('not an image at all'))).toBeNull();
  });

  it('answers null rather than throwing on an empty or absent buffer', () => {
    expect(probeImageDimensions(Buffer.alloc(0))).toBeNull();
    expect(probeImageDimensions(null)).toBeNull();
    expect(probeImageDimensions(undefined)).toBeNull();
    expect(probeImageDimensions('a string')).toBeNull();
  });

  // probe reports an SVG in whatever unit the document declared. "21 ×
  // 29.693548387096772 px" is not a size anyone wants to read.
  it('answers null for a size expressed in anything but pixels', () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="21cm" height="29.7cm" viewBox="0 0 744 1052"></svg>'
    );
    expect(probeImageDimensions(svg)).toBeNull();
  });

  it('rounds a fractional size rather than printing its decimals', () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="744.5" height="1052.3"></svg>'
    );
    expect(probeImageDimensions(svg)).toEqual({ width: 745, height: 1052 });
  });
});

describe('probeImageDimensions — the window it hands the prober', () => {
  // The prober is only ever handed a bounded prefix, whatever the size of
  // the buffer: a wider one for a real JPEG, the narrow one for anything else.
  const TEN_MB = 10 * 1024 * 1024;
  let sync;
  beforeEach(() => {
    sync = jest.spyOn(probe, 'sync');
  });
  afterEach(() => sync.mockRestore());

  const largestWindow = () =>
    Math.max(...sync.mock.calls.map(([buffer]) => buffer.length));

  it('hands the prober the narrow window of a large buffer that is not a JPEG', () => {
    const large = Buffer.concat([Buffer.from('<svg'), Buffer.alloc(TEN_MB)]);

    probeImageDimensions(large);

    expect(largestWindow()).toBeLessThanOrEqual(SNIFF_BYTES);
  });

  // its dimensions sit past the narrow window, so the wide one is used
  it('hands the prober no more than the JPEG window of a large JPEG', () => {
    probeImageDimensions(Buffer.concat([jpeg(65533), Buffer.alloc(TEN_MB)]));

    expect(largestWindow()).toBe(JPEG_SNIFF_BYTES);
  });
});
