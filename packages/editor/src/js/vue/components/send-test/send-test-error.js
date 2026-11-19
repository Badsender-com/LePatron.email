'use strict';

const TOO_MANY_TEST_RECIPIENTS = 'TOO_MANY_TEST_RECIPIENTS';
const TOO_MANY_REQUESTS = 429;

/**
 * The message a refused test send shows: why, when the server says it, the
 * generic one otherwise.
 *
 * @param {Object} error the axios error
 * @returns {string} a key of the editor's dictionaries
 */
function sendTestErrorKey(error) {
  const response = error && error.response;
  if (!response) return 'send-test-error';
  if (response.data && response.data.message === TOO_MANY_TEST_RECIPIENTS) {
    return 'send-test-too-many-recipients';
  }
  if (response.status === TOO_MANY_REQUESTS) return 'send-test-too-many-sends';
  return 'send-test-error';
}

module.exports = { sendTestErrorKey };
