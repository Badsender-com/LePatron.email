'use strict';

jest.mock('axios', () => {
  const post = jest.fn();
  return {
    post,
    isCancel: (err) => Boolean(err && err.__CANCEL__),
    CancelToken: {
      source: () => {
        const token = { reason: null, promise: new Promise(() => {}) };
        return {
          token,
          cancel: (message) => {
            token.reason = { message, __CANCEL__: true };
          },
        };
      },
    },
  };
});

const axios = require('axios');
const {
  postResources,
  createCancel,
  isTooFrequent,
  RETRY_DELAY_MS,
  RETRY_WINDOW_MS,
} = require('../../../packages/editor/src/js/ext/quality/quality-remote.js');

const URL = '/api/mailings/m1/quality/resources';
const resources = { links: ['https://brand.com'], images: [] };
const refusal = (message) => ({ response: { status: 429, data: { message } } });

function clock() {
  let time = 0;
  const delays = [];
  return {
    now: () => time,
    delay: jest.fn((ms) => {
      delays.push(ms);
      time += ms;
      return Promise.resolve();
    }),
    delays,
  };
}

beforeEach(() => axios.post.mockReset());

describe('postResources', () => {
  it('resolves with the server answer, within the timeout', async () => {
    axios.post.mockResolvedValue({ data: { links: {} } });
    const { token } = createCancel();

    await expect(
      postResources(URL, resources, { cancelToken: token })
    ).resolves.toEqual({ links: {} });
    expect(axios.post).toHaveBeenCalledWith(
      URL,
      resources,
      expect.objectContaining({ timeout: 40000, cancelToken: token })
    );
  });

  it('asks again every few seconds while a run of the same user is going on', async () => {
    const { now, delay, delays } = clock();
    axios.post
      .mockRejectedValueOnce(refusal('QUALITY_CHECK_RUNNING'))
      .mockRejectedValueOnce(refusal('QUALITY_CHECK_RUNNING'))
      .mockResolvedValueOnce({ data: { ok: true } });

    await expect(
      postResources(URL, resources, { delay, now })
    ).resolves.toEqual({ ok: true });
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([RETRY_DELAY_MS, RETRY_DELAY_MS]);
  });

  it('gives up a little past the longest run', async () => {
    const { now, delay } = clock();
    axios.post.mockRejectedValue(refusal('QUALITY_CHECK_RUNNING'));

    await expect(postResources(URL, resources, { delay, now })).rejects.toEqual(
      refusal('QUALITY_CHECK_RUNNING')
    );
    const attempts = Math.ceil(RETRY_WINDOW_MS / RETRY_DELAY_MS) + 1;
    expect(axios.post).toHaveBeenCalledTimes(attempts);
  });

  it('does not insist when the user ran too many checks', async () => {
    const { now, delay } = clock();
    const err = refusal('QUALITY_CHECKS_TOO_FREQUENT');
    axios.post.mockRejectedValue(err);

    await expect(postResources(URL, resources, { delay, now })).rejects.toBe(
      err
    );
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(isTooFrequent(err)).toBe(true);
    expect(isTooFrequent(refusal('QUALITY_CHECK_RUNNING'))).toBe(false);
  });

  it('stops asking again once cancelled', async () => {
    const { now, delay } = clock();
    const cancel = createCancel();
    axios.post.mockRejectedValue(refusal('QUALITY_CHECK_RUNNING'));
    delay.mockImplementationOnce(() => {
      cancel.cancel();
      return Promise.resolve();
    });

    await expect(
      postResources(URL, resources, { delay, now, cancelToken: cancel.token })
    ).rejects.toEqual(expect.objectContaining({ __CANCEL__: true }));
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});
