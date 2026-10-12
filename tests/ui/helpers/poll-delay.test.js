'use strict';

const {
  POLL_INTERVAL_MS,
  POLL_MAX_INTERVAL_MS,
  nextPollDelay,
} = require('../../../packages/ui/helpers/poll-delay');

describe('nextPollDelay', () => {
  it('stays at the base interval while the server answers', () => {
    expect(nextPollDelay(POLL_INTERVAL_MS, { failed: false })).toBe(
      POLL_INTERVAL_MS
    );
  });

  it('doubles while the server does not answer', () => {
    expect(nextPollDelay(POLL_INTERVAL_MS, { failed: true })).toBe(
      POLL_INTERVAL_MS * 2
    );
    expect(nextPollDelay(POLL_INTERVAL_MS * 2, { failed: true })).toBe(
      POLL_INTERVAL_MS * 4
    );
  });

  it('never exceeds the ceiling', () => {
    expect(nextPollDelay(POLL_MAX_INTERVAL_MS, { failed: true })).toBe(
      POLL_MAX_INTERVAL_MS
    );
  });

  it('returns to the base interval once the server answers again', () => {
    expect(nextPollDelay(POLL_MAX_INTERVAL_MS, { failed: false })).toBe(
      POLL_INTERVAL_MS
    );
  });
});
