'use strict';

const { PassThrough } = require('stream');

const {
  readDimensions,
  isSafeName,
  classifyError,
  endpointHost,
  READ_STATUS,
} = require('../../scripts/gallery/read-dimensions.js');

// The head of a PNG: signature, then the IHDR chunk carrying the size.
function pngHead(width, height) {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16);
  ihdr.writeUInt8(6, 17);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ihdr,
  ]);
}

// A real 40×30 JPEG, as sharp encodes a flat grey image.
const JPEG_40X30 = Buffer.from(
  '/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERX' +
    'RTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2Nj' +
    'Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAAR' +
    'CAAeACgDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAA' +
    'AAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAA' +
    'AAAAAAAAAP/aAAwDAQACEQMRAD8AAAAAAAAAAAAA/9k=',
  'base64'
);

// The same JPEG with `appBytes` of APP2 metadata (an ICC profile, say) between
// its start marker and the frame header that carries its size.
function jpegWithMetadata(appBytes) {
  const segments = [];
  for (let left = appBytes; left > 0; left -= 65533) {
    const payload = Math.min(left, 65533);
    const segment = Buffer.alloc(payload + 4, 0x20);
    segment.writeUInt16BE(0xffe2, 0);
    segment.writeUInt16BE(payload + 2, 2);
    segments.push(segment);
  }
  return Buffer.concat([
    JPEG_40X30.subarray(0, 2),
    ...segments,
    JPEG_40X30.subarray(2),
  ]);
}

// Cut in 64KB chunks, the way S3 streams it.
function chunked(buffer, size = 64 * 1024) {
  const chunks = [];
  for (let i = 0; i < buffer.length; i += size) {
    chunks.push(buffer.subarray(i, i + size));
  }
  return chunks;
}

// A storage stream that serves `chunks`, or fails with `error`, or stalls.
function storage({ chunks = [], error = null, stall = false } = {}) {
  const streams = [];
  const streamImage = jest.fn(() => {
    const stream = new PassThrough();
    stream.destroy = jest.fn(() => {
      // S3's abort emits an error after the fact
      stream.emit(
        'error',
        Object.assign(new Error('aborted'), { code: 'RequestAbortedError' })
      );
    });
    streams.push(stream);
    setImmediate(() => {
      if (stall) return;
      if (error) {
        stream.emit('error', error);
        return;
      }
      chunks.forEach((chunk) => stream.write(chunk));
      stream.end();
    });
    return stream;
  });
  return { streamImage, streams };
}

describe('read-dimensions', () => {
  describe('readDimensions', () => {
    it('measures an image from the head of the file', async () => {
      const { streamImage } = storage({ chunks: [pngHead(640, 480)] });

      await expect(readDimensions('a.png', { streamImage })).resolves.toEqual({
        status: READ_STATUS.OK,
        width: 640,
        height: 480,
      });
    });

    // Settle before destroying: the abort's error must not win the race and
    // turn every measured file into an unreadable one.
    it('stops reading once it has enough, and keeps the measure', async () => {
      const head = pngHead(10, 20);
      const { streamImage, streams } = storage({
        chunks: [head, Buffer.alloc(64)],
      });

      const result = await readDimensions('a.png', {
        streamImage,
        maxBytes: head.length,
      });

      expect(result).toMatchObject({ status: READ_STATUS.OK, width: 10 });
      expect(streams[0].destroy).toHaveBeenCalled();
    });

    it('tells a file missing from the disk', async () => {
      const error = Object.assign(new Error('nope'), { code: 'ENOENT' });
      const { streamImage } = storage({ error });

      await expect(readDimensions('a.png', { streamImage })).resolves.toEqual({
        status: READ_STATUS.MISSING,
      });
    });

    it('tells a file missing from S3', async () => {
      const error = Object.assign(new Error('nope'), {
        code: 'NoSuchKey',
        statusCode: 404,
      });
      const { streamImage } = storage({ error });

      const result = await readDimensions('a.png', { streamImage });

      expect(result.status).toBe(READ_STATUS.MISSING);
    });

    it('tells a storage error apart, with its code and not its message', async () => {
      const error = Object.assign(new Error('secret detail'), {
        code: 'AccessDenied',
      });
      const { streamImage } = storage({ error });

      await expect(readDimensions('a.png', { streamImage })).resolves.toEqual({
        status: READ_STATUS.ERROR,
        code: 'AccessDenied',
      });
    });

    it('gives up on a stalled read, and aborts it', async () => {
      const { streamImage, streams } = storage({ stall: true });

      const result = await readDimensions('a.png', {
        streamImage,
        timeoutMs: 5,
      });

      expect(result).toEqual({ status: READ_STATUS.TIMEOUT });
      expect(streams[0].destroy).toHaveBeenCalled();
    });

    it('tells a file that is not an image', async () => {
      const { streamImage } = storage({ chunks: [Buffer.from('%PDF-1.4')] });

      const result = await readDimensions('a.pdf', { streamImage });

      expect(result.status).toBe(READ_STATUS.NOT_AN_IMAGE);
    });

    // The size of a JPEG sits after all its metadata segments: past the usual
    // window, it is still an image in use, never "not an image".
    it('measures a JPEG whose metadata runs past the usual window', async () => {
      const read = (jpeg) =>
        readDimensions('a.jpg', {
          streamImage: storage({ chunks: chunked(jpeg) }).streamImage,
        });
      const measured = { status: READ_STATUS.OK, width: 40, height: 30 };

      await expect(read(JPEG_40X30)).resolves.toEqual(measured);
      await expect(read(jpegWithMetadata(240 * 1024))).resolves.toEqual(
        measured
      );
    });

    it('calls a JPEG it cannot measure unmeasured, not "not an image"', async () => {
      const jpeg = jpegWithMetadata(240 * 1024);
      const truncated = jpeg.subarray(0, 200 * 1024);
      const { streamImage } = storage({ chunks: chunked(truncated) });

      await expect(readDimensions('a.jpg', { streamImage })).resolves.toEqual({
        status: READ_STATUS.UNMEASURED,
      });
    });

    it('stops reading a JPEG at its bound', async () => {
      const jpeg = jpegWithMetadata(240 * 1024);
      const { streamImage, streams } = storage({ chunks: chunked(jpeg) });

      const result = await readDimensions('a.jpg', {
        streamImage,
        maxJpegBytes: 128 * 1024,
      });

      expect(result).toEqual({ status: READ_STATUS.UNMEASURED });
      expect(streams[0].destroy).toHaveBeenCalled();
    });

    it('survives a backend that throws instead of streaming', async () => {
      const streamImage = () => {
        throw Object.assign(new Error('x'), { code: 'ENOENT' });
      };

      const result = await readDimensions('a.png', { streamImage });

      expect(result.status).toBe(READ_STATUS.MISSING);
    });

    // A stored name is joined to the upload directory by the local backend.
    it('never hands the storage a name that leaves the upload directory', async () => {
      const { streamImage } = storage();

      for (const name of ['../secret.png', '..', 'a/b.png', '', null, {}]) {
        // eslint-disable-next-line no-await-in-loop
        const result = await readDimensions(name, { streamImage });
        expect(result.status).toBe(READ_STATUS.INVALID_NAME);
      }
      expect(streamImage).not.toHaveBeenCalled();
    });
  });

  describe('isSafeName', () => {
    it('accepts a generated gallery name', () => {
      expect(isSafeName('507f1f77bcf86cd799439011-a1b2c3.png')).toBe(true);
    });

    it('refuses a NUL byte', () => {
      expect(isSafeName('a\0.png')).toBe(false);
    });
  });

  describe('classifyError', () => {
    it('reads a bare 404 as missing', () => {
      expect(classifyError({ statusCode: 404 }).status).toBe(
        READ_STATUS.MISSING
      );
    });

    it('still answers for an error without a code', () => {
      expect(classifyError(new TypeError('x'))).toEqual({
        status: READ_STATUS.ERROR,
        code: 'TypeError',
      });
    });
  });

  describe('endpointHost', () => {
    it('keeps the host of an endpoint, with or without a scheme', () => {
      expect(endpointHost('https://s3.example.test/path')).toBe(
        's3.example.test'
      );
      expect(endpointHost('s3.example.test')).toBe('s3.example.test');
      expect(endpointHost('https://key:secret@s3.example.test')).toBe(
        's3.example.test'
      );
    });
  });
});
