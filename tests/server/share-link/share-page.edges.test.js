'use strict';

// The public page under stress and failure: it stays a page, speaks the
// creator's language, and no reader can lock a link for the others.

const {
  ShareLinks,
  Mailings,
  MAILING_ID,
  lean,
  fakeRes,
  call,
  resetMocks,
} = require('./share-link.harness.js');
const pageController = require('../../../packages/server/share-link/share-page.controller.js');

beforeEach(resetMocks);

describe('GET /share/:token, the edges', () => {
  const TOKEN = 'b'.repeat(43);
  const link = {
    _id: '507f1f77bcf86cd799439022',
    _mailing: MAILING_ID,
    lang: 'en',
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };

  it('answers a failure with a page, never the JSON error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ShareLinks.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('Mongo down')),
    });
    const { res, error } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(500);
    expect(res.render.mock.calls[0][0]).toBe('share-page');
    expect(res.json).not.toHaveBeenCalled();
    console.error.mockRestore();
  });

  it("speaks its creator's language", async () => {
    ShareLinks.findOne.mockReturnValue(
      lean({ ...link, expiresAt: new Date(Date.now() - 1000) })
    );
    const { res } = await call(pageController.renderShare, {
      params: { token: TOKEN },
    });
    expect(res.render.mock.calls[0][1]).toMatchObject({
      lang: 'en',
      title: 'Link expired',
    });
  });

  it('stops a reader opening a link too often, and says when to retry', async () => {
    ShareLinks.findOne.mockReturnValue(lean(link));
    Mailings.findById.mockReturnValue(
      lean({ _id: 'm2', name: 'x', previewHtml: '<p>x</p>' })
    );
    let last;
    for (let i = 0; i < 301; i += 1) {
      last = await call(pageController.renderShare, {
        params: { token: TOKEN },
        ip: '10.0.0.1',
      });
    }
    expect(last.res.statusCode).toBe(429);
    const retryAfter = Number(last.res.headers['Retry-After']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(600);

    // Another reader of the same link is not locked out.
    const other = await call(pageController.renderShare, {
      params: { token: TOKEN },
      ip: '10.0.0.2',
    });
    expect(other.res.statusCode).toBe(200);
  });

  it('answers every made-up token with a 404, however many there are', async () => {
    ShareLinks.findOne.mockReturnValue(lean(null));
    let last;
    for (let i = 0; i < 1001; i += 1) {
      last = await call(pageController.renderShare, {
        params: { token: 'c'.repeat(43) },
        ip: '10.0.0.1',
      });
    }
    expect(last.res.statusCode).toBe(404);
  });

  it('answers with a page when the headers cannot be set', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ShareLinks.findOne.mockReturnValue(lean(link));
    const res = fakeRes();
    res.set.mockImplementationOnce(() => {
      throw new Error('headers already sent');
    });
    let error;
    await pageController.renderShare(
      { params: { token: TOKEN }, get: () => '', ip: '10.0.0.1' },
      res,
      (err) => {
        error = err;
      }
    );
    expect(error).toBeUndefined();
    expect(res.statusCode).toBe(500);
    expect(res.render.mock.calls[0][0]).toBe('share-page');
    console.error.mockRestore();
  });

  it('hands a failure of the error page itself to Express, never crashing', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ShareLinks.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('Mongo down')),
    });
    const res = fakeRes();
    const broken = new Error('template broken');
    res.render.mockImplementation(() => {
      throw broken;
    });
    let error;
    await pageController.renderShare(
      { params: { token: TOKEN }, get: () => '', ip: '10.0.0.1' },
      res,
      (err) => {
        error = err;
      }
    );
    expect(error).toBe(broken);
    console.error.mockRestore();
  });
});
