'use strict';

// What the public route of the relayed images (ADR 0022) may cost the
// instance: the images it fetched are kept a few minutes, one fetch serves
// every request for the same image, and a process runs a bounded number of
// fetches at a time.

const mockGuardedFetch = jest.fn();
jest.mock(
  '../../../packages/server/integration-providers/provider-http.js',
  () => ({
    ...jest.requireActual(
      '../../../packages/server/integration-providers/provider-http.js'
    ),
    guardedFetch: (...args) => mockGuardedFetch(...args),
  })
);

const FETCH = '../../../packages/server/mcp/mcp-relayed-image-fetch.js';
const LOGO = 'https://cdn.example.test/brand/logo.png';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

const anImage = () => ({ ok: true, status: 200, buffer: async () => PNG });

describe('the fetch of a relayed image', () => {
  let relayedImage;
  let MAX_FETCHES_IN_FLIGHT;

  beforeEach(() => {
    mockGuardedFetch.mockReset();
    jest.isolateModules(() => {
      // eslint-disable-next-line import/no-dynamic-require
      ({ relayedImage, MAX_FETCHES_IN_FLIGHT } = require(FETCH));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps an image it fetched ten minutes', async () => {
    let at = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => at);
    mockGuardedFetch.mockImplementation(async () => anImage());

    await relayedImage(LOGO);
    at = 10 * 60 * 1000 - 1;
    const kept = await relayedImage(LOGO);
    expect(mockGuardedFetch).toHaveBeenCalledTimes(1);
    expect(kept.bytes).toEqual(PNG);

    at = 10 * 60 * 1000;
    await relayedImage(LOGO);
    expect(mockGuardedFetch).toHaveBeenCalledTimes(2);
  });

  it('fetches an image once for every request that asks for it meanwhile', async () => {
    let answer;
    mockGuardedFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );

    const requests = [relayedImage(LOGO), relayedImage(LOGO)];
    answer(anImage());
    const [first, second] = await Promise.all(requests);

    expect(mockGuardedFetch).toHaveBeenCalledTimes(1);
    expect(first.bytes).toEqual(PNG);
    expect(second).toBe(first);
  });

  it('answers no image past the fetches a process may run at a time', async () => {
    const answers = [];
    mockGuardedFetch.mockImplementation(
      () => new Promise((resolve) => answers.push(resolve))
    );
    const running = Array.from({ length: MAX_FETCHES_IN_FLIGHT }, (_, i) =>
      relayedImage(`https://cdn.example.test/${i}.png`)
    );

    const past = await relayedImage('https://cdn.example.test/one-more.png');

    expect(past).toBeNull();
    expect(mockGuardedFetch).toHaveBeenCalledTimes(MAX_FETCHES_IN_FLIGHT);
    answers.forEach((answer) => answer(anImage()));
    await Promise.all(running);
    mockGuardedFetch.mockImplementation(async () => anImage());
    await relayedImage('https://cdn.example.test/one-more.png');
    expect(mockGuardedFetch).toHaveBeenCalledTimes(MAX_FETCHES_IN_FLIGHT + 1);
  });
});
