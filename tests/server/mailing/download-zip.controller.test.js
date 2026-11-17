'use strict';

// What the download route answers when the export fails: the code, and the
// images an image host could not take, for the editor to name them
// (ADR 0028).

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  downloadZip: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const {
  downloadZip,
} = require('../../../packages/server/mailing/download-zip.controller.js');

async function call() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  await downloadZip(
    {
      user: { id: 'user-1' },
      params: { mailingId: 'm1' },
      body: { html: '<html></html>', hostingIntegrationId: 'i1' },
    },
    res,
    jest.fn()
  );
  return res;
}

describe('the download route, when the export fails', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('names the images the image host could not take', async () => {
    const error = new Error('IMAGE_HOST_UPLOAD_FAILED');
    error.status = 502;
    error.images = ['https://cdn.client.example.com/brand/logo.gif'];
    mailingService.downloadZip.mockRejectedValue(error);

    const res = await call();

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      errorCode: 'IMAGE_HOST_UPLOAD_FAILED',
      images: ['https://cdn.client.example.com/brand/logo.gif'],
    });
  });

  it('answers the code alone otherwise, as before', async () => {
    const error = new Error('EXPORT_IMAGES_NOT_TRANSFERRED');
    error.status = 500;
    mailingService.downloadZip.mockRejectedValue(error);

    const res = await call();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      errorCode: 'EXPORT_IMAGES_NOT_TRANSFERRED',
    });
  });
});
