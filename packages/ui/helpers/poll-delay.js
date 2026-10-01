// Polling a long-running server job without piling requests onto a server
// that has stopped answering. A fixed interval did exactly that while a
// translation held the server: polls queued up until they used every
// connection the browser opens to the app, the cancel button included.

// The status endpoint is cheap: 2 s keeps a progress bar live.
export const POLL_INTERVAL_MS = 2000;
// A stuck server is still asked, but rarely.
export const POLL_MAX_INTERVAL_MS = 30000;
// A status answer takes milliseconds. Past this the server is busy, and a
// request held open only takes a connection another request needs.
export const POLL_REQUEST_TIMEOUT_MS = 10000;

/**
 * Delay before the next poll: back to the base interval once the server
 * answers, doubled up to the ceiling while it does not.
 * @param {number} currentDelay - Delay used before the poll that just ended
 * @param {{ failed: boolean }} outcome
 * @returns {number}
 */
export function nextPollDelay(currentDelay, { failed }) {
  if (!failed) return POLL_INTERVAL_MS;
  return Math.min(
    Math.max(currentDelay, POLL_INTERVAL_MS) * 2,
    POLL_MAX_INTERVAL_MS
  );
}
