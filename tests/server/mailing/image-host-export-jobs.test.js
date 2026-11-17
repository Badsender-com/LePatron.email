'use strict';

// The export to an image host as a job (ADR 0029): started at once, the
// images put afterwards, its progress and outcome read by the user who
// started it, an instance that stops told within 20 seconds of silence.
// The export itself is stubbed: it is tested with mailing.service
// (image-host-export.test.js).

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  ImageHostExportJobs: {},
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  prepareImageHostExport: jest.fn(),
}));

const models = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const {
  startImageHostExport,
  getImageHostExport,
  getImageHostExportResult,
} = require('../../../packages/server/mailing/image-host-export-jobs.js');

const alice = { id: 'user-alice' };
const bob = { id: 'user-bob' };

/** The jobs, in memory. */
function jobStore() {
  const docs = [];
  const matches = (doc, filter) =>
    Object.entries(filter).every(([k, v]) => String(doc[k]) === String(v));
  const query = (value) => ({
    lean: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  });
  Object.assign(models.ImageHostExportJobs, {
    docs,
    create: jest.fn(async (doc) => {
      const created = { ...doc, updatedAt: new Date() };
      docs.push(created);
      return created;
    }),
    findOne: jest.fn((filter) =>
      query(docs.find((d) => matches(d, filter)) || null)
    ),
    updateOne: jest.fn(async (filter, update) => {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return { matchedCount: 0 };
      Object.entries(update.$set || {}).forEach(([path, value]) => {
        const keys = path.split('.');
        const last = keys.pop();
        const target = keys.reduce((node, key) => node[key], doc);
        target[last] = value;
      });
      doc.updatedAt = new Date();
      return { matchedCount: 1 };
    }),
  });
  return docs;
}

/** An export whose images are put when the test says so. */
function preparedExport({ imageCount = 3 } = {}) {
  let finish;
  let fail;
  const control = {};
  const prepared = {
    mailingId: 'mailing-1',
    integrationId: 'integration-1',
    imageCount,
    run: jest.fn(
      (onProgress) =>
        new Promise((resolve, reject) => {
          control.onProgress = onProgress;
          finish = resolve;
          fail = reject;
        })
    ),
  };
  mailingService.prepareImageHostExport.mockResolvedValue(prepared);
  control.finish = (result) => finish(result);
  control.fail = (error) => fail(error);
  return control;
}

const start = (user = alice) =>
  startImageHostExport({
    mailingId: 'mailing-1',
    html: '<html></html>',
    user,
    hostingIntegrationId: 'integration-1',
  });

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('the export to an image host, as a job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jobStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('answers at once, the images being put afterwards', async () => {
    const control = preparedExport();

    const { jobId } = await start();

    expect(jobId).toEqual(expect.any(String));
    await expect(getImageHostExport({ jobId, user: alice })).resolves.toEqual({
      jobId,
      status: 'hosting',
      progress: { done: 0, total: 3 },
      error: null,
    });
    control.finish({ prefix: 'p/', name: 'n', html: '<html>done</html>' });
  });

  it('refuses at once what can be checked at once, and starts no job', async () => {
    const refusal = new Error('IMAGE_HOST_NOT_AVAILABLE');
    mailingService.prepareImageHostExport.mockRejectedValue(refusal);

    await expect(start()).rejects.toBe(refusal);
    expect(models.ImageHostExportJobs.create).not.toHaveBeenCalled();
  });

  it('tells how many images are on the host', async () => {
    const control = preparedExport();
    const { jobId } = await start();

    await control.onProgress({ done: 2, total: 3 });

    const job = await getImageHostExport({ jobId, user: alice });
    expect(job.progress).toEqual({ done: 2, total: 3 });
    control.finish({ prefix: 'p/', name: 'n', html: '' });
  });

  it('keeps the HTML of a completed export for its ZIP', async () => {
    const control = preparedExport();
    const { jobId } = await start();

    control.finish({
      prefix: 'soldes/',
      name: 'soldes',
      html: '<html>ok</html>',
    });
    await settle();

    await expect(
      getImageHostExport({ jobId, user: alice })
    ).resolves.toMatchObject({ status: 'completed', error: null });
    await expect(
      getImageHostExportResult({ jobId, user: alice })
    ).resolves.toEqual({
      prefix: 'soldes/',
      name: 'soldes',
      html: '<html>ok</html>',
    });
  });

  it('says why a failed export failed, naming its images', async () => {
    const control = preparedExport();
    const { jobId } = await start();
    const failure = new Error('IMAGE_HOST_UPLOAD_FAILED');
    failure.images = ['https://cdn.example.com/logo.gif'];

    control.fail(failure);
    await settle();

    await expect(
      getImageHostExport({ jobId, user: alice })
    ).resolves.toMatchObject({
      status: 'failed',
      error: {
        code: 'IMAGE_HOST_UPLOAD_FAILED',
        images: ['https://cdn.example.com/logo.gif'],
      },
    });
  });

  it('keeps the text of an unexpected error to itself', async () => {
    const control = preparedExport();
    const { jobId } = await start();

    control.fail(new Error('connect ECONNREFUSED 10.0.0.12:27017'));
    await settle();

    const job = await getImageHostExport({ jobId, user: alice });
    expect(job.error).toEqual({ code: 'IMAGE_HOST_EXPORT_FAILED', images: [] });
  });

  it('gives no ZIP before the export is completed', async () => {
    const control = preparedExport();
    const { jobId } = await start();

    await expect(
      getImageHostExportResult({ jobId, user: alice })
    ).rejects.toThrow('IMAGE_HOST_EXPORT_NOT_COMPLETED');
    control.finish({ prefix: '', name: 'n', html: '' });
  });

  it('lets no other user read the job, nor download its ZIP', async () => {
    const control = preparedExport();
    const { jobId } = await start(alice);
    control.finish({ prefix: '', name: 'n', html: '<html></html>' });
    await settle();

    await expect(getImageHostExport({ jobId, user: bob })).rejects.toThrow(
      'IMAGE_HOST_EXPORT_NOT_FOUND'
    );
    await expect(
      getImageHostExportResult({ jobId, user: bob })
    ).rejects.toThrow('IMAGE_HOST_EXPORT_NOT_FOUND');
  });

  // A slow upload keeps the job beating: only a stopped instance falls silent.
  it('beats every 5 seconds while the images are put', async () => {
    jest.useFakeTimers('modern');
    const control = preparedExport();
    const { jobId } = await start();
    models.ImageHostExportJobs.updateOne.mockClear();

    jest.advanceTimersByTime(15000);

    const beats = models.ImageHostExportJobs.updateOne.mock.calls.filter(
      ([filter, update]) => filter.jobId === jobId && update.$set.heartbeatAt
    );
    expect(beats).toHaveLength(3);
    control.finish({ prefix: '', name: 'n', html: '' });
  });

  it('reads a job silent for 20 seconds as interrupted', async () => {
    preparedExport();
    const { jobId } = await start();
    const job = models.ImageHostExportJobs.docs.find((d) => d.jobId === jobId);
    job.heartbeatAt = new Date(Date.now() - 21000);

    await expect(
      getImageHostExport({ jobId, user: alice })
    ).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'IMAGE_HOST_EXPORT_INTERRUPTED', images: [] },
    });
  });

  it('does not read a job beating 15 seconds ago as interrupted', async () => {
    preparedExport();
    const { jobId } = await start();
    const job = models.ImageHostExportJobs.docs.find((d) => d.jobId === jobId);
    job.heartbeatAt = new Date(Date.now() - 15000);

    await expect(
      getImageHostExport({ jobId, user: alice })
    ).resolves.toMatchObject({
      status: 'hosting',
    });
  });
});
