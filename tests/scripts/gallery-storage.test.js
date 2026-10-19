'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');

const {
  openFromS3,
  openFromDisk,
  endpointHost,
} = require('../../scripts/gallery/storage.js');

// What `s3.getObject()` returns: a request that announces its headers, then
// completes, and streams the body.
function fakeS3() {
  const requests = [];
  const s3 = {
    getObject: jest.fn(() => {
      const request = new EventEmitter();
      request.stream = new PassThrough();
      request.createReadStream = () => request.stream;
      request.abort = jest.fn();
      requests.push(request);
      return request;
    }),
  };
  return { s3, requests };
}

describe('gallery storage', () => {
  describe('openFromS3', () => {
    it('reads the bucket object, and its Last-Modified as the date', async () => {
      const { s3, requests } = fakeS3();

      const { storedAt } = openFromS3(s3, 'bucket')('a.png');
      requests[0].emit('httpHeaders', 200, {
        'last-modified': 'Thu, 04 Mar 2021 05:06:07 GMT',
      });

      expect(s3.getObject).toHaveBeenCalledWith({
        Bucket: 'bucket',
        Key: 'a.png',
      });
      await expect(storedAt).resolves.toEqual(new Date('2021-03-04T05:06:07Z'));
    });

    // The SDK retries a 5xx: the date is the answer that served the file.
    it('takes the date of the answer that served the file', async () => {
      const { s3, requests } = fakeS3();

      const { storedAt } = openFromS3(s3, 'bucket')('a.png');
      requests[0].emit('httpHeaders', 503, {});
      requests[0].emit('httpHeaders', 200, {
        'last-modified': 'Thu, 04 Mar 2021 05:06:07 GMT',
      });

      await expect(storedAt).resolves.toEqual(new Date('2021-03-04T05:06:07Z'));
    });

    it('gives no date for a missing object or an unreadable header', async () => {
      const missing = fakeS3();
      const missingDate = openFromS3(missing.s3, 'b')('a.png').storedAt;
      missing.requests[0].emit('httpHeaders', 404, {});
      missing.requests[0].emit('complete');

      const garbled = fakeS3();
      const garbledDate = openFromS3(garbled.s3, 'b')('a.png').storedAt;
      garbled.requests[0].emit('httpHeaders', 200, {
        'last-modified': 'yesterday',
      });

      await expect(missingDate).resolves.toBeNull();
      await expect(garbledDate).resolves.toBeNull();
    });

    it('aborts the request when the stream is destroyed', () => {
      const { s3, requests } = fakeS3();

      openFromS3(s3, 'bucket')('a.png').stream.destroy();

      expect(requests[0].abort).toHaveBeenCalled();
    });
  });

  describe('openFromDisk', () => {
    let directory;

    beforeEach(() => {
      directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-storage-'));
    });
    afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

    it('reads the file, and its modification time as the date', async () => {
      const file = path.join(directory, 'a.png');
      fs.writeFileSync(file, 'bytes');
      const mtime = new Date('2021-03-04T05:06:07Z');
      fs.utimesSync(file, mtime, mtime);

      const { stream, storedAt } = openFromDisk(directory)('a.png');
      stream.destroy();

      await expect(storedAt).resolves.toEqual(mtime);
    });

    it('gives no date for a missing file', async () => {
      const { stream, storedAt } = openFromDisk(directory)('gone.png');
      const error = new Promise((resolve) => stream.on('error', resolve));

      await expect(storedAt).resolves.toBeNull();
      await expect(error).resolves.toMatchObject({ code: 'ENOENT' });
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
