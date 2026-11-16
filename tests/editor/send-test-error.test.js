'use strict';

// A refused test send says why when the server says it: too many addresses
// for one send, or too many sends in the hour. Anything else keeps the
// generic message.

const fs = require('fs');
const path = require('path');

const fr = require('../../public/lang/badsender-fr.js');
const en = require('../../public/lang/badsender-en.js');
const {
  sendTestErrorKey,
} = require('../../packages/editor/src/js/vue/components/send-test/send-test-error.js');

const failure = (status, message) => ({
  response: { status, data: { status, message } },
});

describe('sendTestErrorKey', () => {
  it.each([
    [failure(400, 'TOO_MANY_TEST_RECIPIENTS'), 'send-test-too-many-recipients'],
    [failure(429, 'Too Many Requests'), 'send-test-too-many-sends'],
    [failure(400, 'EMAIL_NOT_VALID'), 'send-test-error'],
    [failure(500, 'boom'), 'send-test-error'],
    [new Error('Network Error'), 'send-test-error'],
  ])('%o → %s', (error, key) => {
    expect(sendTestErrorKey(error)).toBe(key);
  });
});

describe('the send-test messages', () => {
  it.each([
    ['fr', fr],
    ['en', en],
  ])('are translated in %s', (_locale, dictionary) => {
    [
      'send-test-error',
      'send-test-too-many-recipients',
      'send-test-too-many-sends',
    ].forEach((key) => expect(typeof dictionary[key]).toBe('string'));
  });

  it('are the ones the send-test modal shows', () => {
    const modal = fs.readFileSync(
      path.join(
        __dirname,
        '../../packages/editor/src/js/vue/components/send-test/test-modal.js'
      ),
      'utf8'
    );
    expect(modal).toMatch(/this\.vm\.t\(sendTestErrorKey\(error\)\)/);
  });
});
