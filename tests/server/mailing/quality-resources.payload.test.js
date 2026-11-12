'use strict';

// What the editor may send for the server's checks, and the route that takes
// it: nothing is read, nor fetched, before the payload and the right to open
// the email are both settled.

const { resetQuality } = require('./quality-resources.harness.js');
const config = require('../../../packages/server/node.config.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const controller = require('../../../packages/server/mailing/mailing-quality.controller.js');
const qualityResourcesService = require('../../../packages/server/mailing/quality-resources.service.js');
const {
  validateResourcesPayload,
  MAX_LINKS,
} = require('../../../packages/server/mailing/quality-resources.service.js');

beforeEach(resetQuality);

describe('validateResourcesPayload', () => {
  it('keeps distinct http(s) addresses, as sent', () => {
    expect(
      validateResourcesPayload({
        links: ['https://a.test/x', 'https://a.test/x', 'http://b.test'],
        images: [{ url: 'https://a.test/i.png' }],
      })
    ).toEqual({
      links: ['https://a.test/x', 'http://b.test'],
      images: ['https://a.test/i.png'],
    });
  });

  it.each([
    ['another key', { links: [], extra: 1 }],
    ['a non-web scheme', { links: ['javascript:alert(1)'] }],
    ['a file URL', { images: [{ url: 'file:///etc/passwd' }] }],
    ['not a URL', { links: ['nope'] }],
    ['too many links', { links: Array(MAX_LINKS + 1).fill('https://a.test') }],
    ['an overlong URL', { links: [`https://a.test/${'x'.repeat(2100)}`] }],
    ['a list that is not one', { links: 'https://a.test' }],
  ])('refuses %s', (label, body) => {
    expect(() => validateResourcesPayload(body)).toThrow(
      expect.objectContaining({
        status: 422,
        message: 'INVALID_QUALITY_RESOURCES',
      })
    );
  });
});

describe('POST /mailings/:mailingId/quality/resources', () => {
  it('reads nothing when the payload is invalid', async () => {
    let error;
    await controller.checkResources(
      { params: { mailingId: 'm1' }, body: { links: ['ftp://x'] }, user: {} },
      { json: jest.fn() },
      (err) => {
        error = err;
      }
    );
    expect(error.status).toBe(422);
    expect(mailingService.findOneForUser).not.toHaveBeenCalled();
  });

  it('checks nothing for someone who cannot open the email', async () => {
    const notFound = Object.assign(new Error('MAILING_NOT_FOUND'), {
      status: 404,
    });
    mailingService.findOneForUser.mockRejectedValue(notFound);
    const res = { json: jest.fn() };
    let error;
    await controller.checkResources(
      {
        params: { mailingId: 'm1' },
        body: { links: ['https://a.test'] },
        user: { id: 'u1' },
        get: () => 'app.test',
      },
      res,
      (err) => {
        error = err;
      }
    );
    expect(error).toBe(notFound);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('takes our images from the configured host, never from the host the request names', async () => {
    mailingService.findOneForUser.mockResolvedValue({ _company: 'c1' });
    const check = jest
      .spyOn(qualityResourcesService, 'checkResources')
      .mockResolvedValue({});
    await controller.checkResources(
      {
        params: { mailingId: 'm1' },
        body: { images: [{ url: 'https://evil.test/api/images/a.png' }] },
        user: { id: 'u1' },
        get: () => 'evil.test',
      },
      { json: jest.fn(), on: jest.fn() },
      jest.fn()
    );
    expect(check.mock.calls[0][1].ownHosts).toEqual([config.host]);
    check.mockRestore();
  });

  it('cuts the run short once the client went away, not once it answered', async () => {
    mailingService.findOneForUser.mockResolvedValue({ _company: 'c1' });
    const check = jest
      .spyOn(qualityResourcesService, 'checkResources')
      .mockResolvedValue({});
    const request = (res) =>
      controller.checkResources(
        {
          params: { mailingId: 'm1' },
          body: { links: ['https://a.test'] },
          user: { id: 'u1' },
          get: () => 'app.test',
          on: jest.fn(),
        },
        res,
        jest.fn()
      );
    const response = () => {
      const listeners = {};
      return {
        listeners,
        writableFinished: false,
        json: jest.fn(),
        on: (event, listener) => {
          listeners[event] = listener;
        },
      };
    };

    // The client closes before the answer: the run stops fetching.
    const gone = response();
    await request(gone);
    const { signal } = check.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    gone.listeners.close();
    expect(signal.aborted).toBe(true);

    // The response is complete: its closing is no cancellation.
    const answered = response();
    await request(answered);
    answered.writableFinished = true;
    answered.listeners.close();
    expect(check.mock.calls[1][1].signal.aborted).toBe(false);
    check.mockRestore();
  });
});
