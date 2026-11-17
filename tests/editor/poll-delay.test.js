'use strict';

const {
  nextPollDelay,
  POLL_INTERVAL_MS,
  POLL_MAX_INTERVAL_MS,
} = require('../../packages/editor/src/js/vue/utils/poll-delay.js');

describe("the editor's poll delay", () => {
  it('asks every 2 seconds while the server answers', () => {
    expect(nextPollDelay(16000, { failed: false })).toBe(POLL_INTERVAL_MS);
  });

  it('doubles while the server does not answer, up to 30 seconds', () => {
    expect(nextPollDelay(2000, { failed: true })).toBe(4000);
    expect(nextPollDelay(16000, { failed: true })).toBe(POLL_MAX_INTERVAL_MS);
    expect(nextPollDelay(30000, { failed: true })).toBe(POLL_MAX_INTERVAL_MS);
  });
});
