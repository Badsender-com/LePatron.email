'use strict';

// Asking a long-running server job for its status without piling requests on
// a server that has stopped answering: the rule of the interface's
// translation (packages/ui/helpers/poll-delay.js), for the editor.

// The status is cheap: 2 s keeps a progress bar live.
const POLL_INTERVAL_MS = 2000;
// A stuck server is still asked, but rarely.
const POLL_MAX_INTERVAL_MS = 30000;
// Past this the server is busy: a request held open takes a connection.
const POLL_REQUEST_TIMEOUT_MS = 10000;

/**
 * Delay before the next poll: back to the base interval once the server
 * answers, doubled up to the ceiling while it does not.
 * @param {number} currentDelay
 * @param {{ failed: boolean }} outcome
 * @returns {number}
 */
function nextPollDelay(currentDelay, { failed }) {
  if (!failed) return POLL_INTERVAL_MS;
  return Math.min(
    Math.max(currentDelay, POLL_INTERVAL_MS) * 2,
    POLL_MAX_INTERVAL_MS
  );
}

module.exports = {
  POLL_INTERVAL_MS,
  POLL_MAX_INTERVAL_MS,
  POLL_REQUEST_TIMEOUT_MS,
  nextPollDelay,
};
