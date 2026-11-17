'use strict';

// The HTTP answers of the export to an image host (ADR 0029): 202 and the job
// when started, a real ZIP of the HTML alone once completed.

const { Writable } = require('stream');
const AdmZip = require('adm-zip');

jest.mock('../../../packages/server/mailing/image-host-export-jobs.js', () => ({
  startImageHostExport: jest.fn(),
  getImageHostExport: jest.fn(),
  getImageHostExportResult: jest.fn(),
}));

const jobs = require('../../../packages/server/mailing/image-host-export-jobs.js');
const controller = require('../../../packages/server/mailing/image-host-export.controller.js');

const user = { id: 'user-alice' };

describe('the export to an image host, over HTTP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('answers 202 with the job, from what the editor sends', async () => {
    jobs.startImageHostExport.mockResolvedValue({ jobId: 'job-1' });
    const res = { status: jest.fn(() => res), json: jest.fn() };

    await controller.start(
      {
        user,
        params: { mailingId: 'mailing-1' },
        body: {
          html: '<html></html>',
          hostingIntegrationId: 'integration-1',
          tracking: { trackingUrls: [] },
          anythingElse: 'ignored',
        },
      },
      res,
      jest.fn()
    );

    expect(jobs.startImageHostExport).toHaveBeenCalledWith({
      mailingId: 'mailing-1',
      html: '<html></html>',
      user,
      hostingIntegrationId: 'integration-1',
      freshTracking: { trackingUrls: [] },
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ jobId: 'job-1' });
  });

  it('downloads a ZIP holding the HTML of the completed export alone', async () => {
    jobs.getImageHostExportResult.mockResolvedValue({
      prefix: 'soldes-ete/',
      name: 'soldes-ete',
      html: '<html>hosted</html>',
    });
    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });
    res.attachment = jest.fn();
    const finished = new Promise((resolve) => res.on('finish', resolve));

    await controller.zip({ user, params: { jobId: 'job-1' } }, res, jest.fn());
    await finished;

    expect(jobs.getImageHostExportResult).toHaveBeenCalledWith({
      jobId: 'job-1',
      user,
    });
    expect(res.attachment).toHaveBeenCalledWith('soldes-ete.zip');
    const entries = new AdmZip(Buffer.concat(chunks)).getEntries();
    expect(entries.map((e) => e.entryName)).toEqual([
      'soldes-ete/soldes-ete.html',
    ]);
    expect(entries[0].getData().toString()).toBe('<html>hosted</html>');
  });
});
