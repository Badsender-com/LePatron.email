'use strict';

// What the images of an email weigh once exported: ours measured the way the
// export gets them, never at the host a caller names, within the bytes a run
// may download.

const {
  ONE_PIXEL_PNG,
  deps,
  run,
  resetQuality,
} = require('./quality-resources.harness.js');
const {
  measuredUrl,
  measureImage,
  fetchOwn,
} = require('../../../packages/server/mailing/quality-images.service.js');
const {
  ProbeError,
  PROBE_FAILURES,
} = require('../../../packages/server/utils/url-probe.js');

beforeEach(resetQuality);

describe('images', () => {
  it('downloads an image without the credentials typed in its address', async () => {
    const d = deps();
    const { images } = await run(
      { images: ['https://user:secret@cdn.test/a.png'] },
      d
    );
    expect(d.probe.mock.calls[0][0]).toBe('https://cdn.test/a.png');
    expect(images['https://user:secret@cdn.test/a.png'].state).toBe('ok');
  });

  it('weighs an image and reads its size', async () => {
    const { images } = await run(
      { images: ['https://cdn.test/a.png'] },
      deps()
    );
    expect(images['https://cdn.test/a.png']).toEqual({
      state: 'ok',
      bytes: ONE_PIXEL_PNG.length,
      width: 1,
      height: 1,
      type: 'png',
    });
  });

  it('measures our own images the way the export gets them, never at the host named', async () => {
    const d = deps();
    await run(
      { images: ['https://app.test/api/images/resize/600x0/a.png?x=1'] },
      d
    );
    expect(d.fetchOwn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^http:\/\/127\.0\.0\.1:\d+\/api\/images\/resize\/600x0\/a\.png$/
      ),
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(d.probe).not.toHaveBeenCalled();
  });

  it.each([
    'https://app.test/api/images/a.png',
    'https://app.test/api/images/cover/600xnull/a.png',
  ])('reads %s as one of our images', (url) => {
    expect(measuredUrl(url, ['app.test']).own).toBe(true);
  });

  it.each([
    'https://evil.test/api/images/a.png',
    'https://app.test/admin',
    'https://app.test/api/images/placeholder/30000x30000.png',
    'https://app.test/api/images/resize/99999x1/a.png',
    'https://app.test/api/images/gallery/abc',
    'https://app.test/api/images/a%2Fb.png',
  ])('goes through the guarded probe for %s', (url) => {
    expect(measuredUrl(url, ['app.test']).own).toBe(false);
  });

  it('keeps the measure of one of our own images for a day, of another image a few minutes', async () => {
    const d = deps();
    const resources = {
      images: ['https://app.test/api/images/a.png', 'https://cdn.test/a.png'],
    };
    await run(resources, d);
    const now = Date.now;
    jest.spyOn(Date, 'now').mockImplementation(() => now() + 60 * 60 * 1000);
    await run(resources, d, { userKey: 'u2' });
    Date.now.mockRestore();
    // The image at a given URL of ours does not change: measured once.
    expect(d.fetchOwn).toHaveBeenCalledTimes(1);
    expect(d.probe).toHaveBeenCalledTimes(2);
  });

  it('does not let the host a caller names decide what an URL reads', async () => {
    const d = deps();
    // Measured as ours, under our path: never under the victim's URL.
    await run({ images: ['https://cdn.victim.test/api/images/a.png'] }, d, {
      ownHosts: ['cdn.victim.test'],
    });
    await run({ images: ['https://cdn.victim.test/api/images/a.png'] }, d, {
      userKey: 'u2',
    });
    expect(d.fetchOwn).toHaveBeenCalledTimes(1);
    expect(d.probe).toHaveBeenCalledTimes(1);
  });

  it('stops downloading once the run has spent its budget', async () => {
    const tenMb = Buffer.alloc(10 * 1024 * 1024);
    const d = deps({
      probe: jest.fn(async () => ({ status: 200, body: tenMb })),
    });
    // The budget is checked before each download: four run at once, so a run
    // may overshoot it by four images at most, never by twelve.
    const urls = Array.from(
      { length: 12 },
      (_, i) => `https://cdn.test/${i}.jpg`
    );
    const { images } = await run({ images: urls }, d);
    const states = urls.map((url) => images[url].state);
    expect(states).toContain('unverifiable');
    expect(d.probe.mock.calls.length).toBeLessThan(urls.length);
  });

  it('leaves unread an image whose announced size does not fit in what is left of the budget', async () => {
    const MB = 1024 * 1024;
    // The server announces the size; the body stays small here, the
    // accounting is what is pinned.
    const announcing = (contentLength) =>
      jest.fn(async (url, options) =>
        options.acceptBody({ contentLength })
          ? { status: 200, body: ONE_PIXEL_PNG }
          : { status: 200, body: null }
      );
    const target = { own: false, url: 'https://cdn.test/a.jpg' };
    const nearlySpent = () => ({
      deadline: Date.now() + 20000,
      bytes: 45 * MB,
    });

    // Decided on the announcement, before the body: the request is made.
    let run = nearlySpent();
    let probe = announcing(10 * MB);
    await expect(measureImage(target, run, { probe })).resolves.toEqual({
      state: 'unverifiable',
    });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(run.bytes).toBe(45 * MB);

    // What fits is taken from the budget at the announcement, then settled
    // against what was read.
    run = nearlySpent();
    probe = announcing(5 * MB);
    await expect(measureImage(target, run, { probe })).resolves.toMatchObject({
      state: 'ok',
      bytes: ONE_PIXEL_PNG.length,
    });
    expect(run.bytes).toBe(45 * MB + ONE_PIXEL_PNG.length);

    // At most MAX_IMAGE_BYTES is read of an image, whatever it announces.
    run = { deadline: Date.now() + 20000, bytes: 0 };
    probe = announcing(60 * MB);
    await expect(measureImage(target, run, { probe })).resolves.toMatchObject({
      state: 'ok',
    });
  });

  it('says "at least" for an image past the ceiling', async () => {
    const d = deps({
      probe: jest.fn(async () => {
        throw new ProbeError(PROBE_FAILURES.TOO_LARGE);
      }),
    });
    const { images } = await run({ images: ['https://cdn.test/big.gif'] }, d);
    expect(images['https://cdn.test/big.gif']).toMatchObject({
      state: 'ok',
      atLeast: true,
    });
  });

  it('does not judge an image at an address the guard refuses', async () => {
    const d = deps({
      probe: jest.fn(async () => {
        throw new ProbeError(PROBE_FAILURES.REFUSED);
      }),
    });
    const { images } = await run(
      { images: ['http://localhost:3000/api/images/a.png'] },
      d
    );
    expect(images['http://localhost:3000/api/images/a.png']).toEqual({
      state: 'unverifiable',
    });
  });

  it('asks our own backend as if through https, since it redirects plain http outside development', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      buffer: async () => ONE_PIXEL_PNG,
    }));
    await fetchOwn('http://127.0.0.1:3000/api/images/a.png', {
      timeoutMs: 5000,
      fetchImpl,
    });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { 'X-Forwarded-Proto': 'https' },
      redirect: 'manual',
    });
  });

  it('leaves the body of our own image unread when the caller declines its announced size', async () => {
    const body = { destroy: jest.fn() };
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => '2048' },
      body,
      buffer: async () => ONE_PIXEL_PNG,
    }));
    const acceptBody = jest.fn(() => false);
    const result = await fetchOwn('http://127.0.0.1:3000/api/images/a.png', {
      timeoutMs: 5000,
      fetchImpl,
      acceptBody,
    });
    expect(acceptBody).toHaveBeenCalledWith({ contentLength: 2048 });
    expect(result).toEqual({ status: 200, body: null });
    expect(body.destroy).toHaveBeenCalled();
  });

  it('does not judge an image our backend answers with a redirect or an error', async () => {
    const d = deps({
      fetchOwn: jest.fn(async () => ({ status: 302, body: null })),
    });
    const { images } = await run(
      { images: ['https://app.test/api/images/a.png'] },
      d
    );
    expect(images['https://app.test/api/images/a.png']).toEqual({
      state: 'unverifiable',
    });
  });

  it('reports an image that cannot be fetched', async () => {
    const d = deps({
      probe: jest.fn(async () => ({ status: 404, body: null })),
    });
    const { images } = await run({ images: ['https://cdn.test/x.png'] }, d);
    expect(images['https://cdn.test/x.png']).toEqual({
      state: 'unreachable',
      httpStatus: 404,
    });
  });
});
