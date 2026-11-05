'use strict';

// What the AI panel tells the user when a text generation request fails: a
// refusal for the user or the email is not the feature switched off for the
// company (ADR 0020).

const {
  errorKey,
} = require('../../../packages/editor/src/js/ext/ai-panel/sessions/errors.js');

const failure = (status, message) => ({
  response: { status, data: message ? { message } : undefined },
});

describe('errorKey', () => {
  it('says the feature is off only when the server says so', () => {
    expect(errorKey(failure(403, 'TEXT_GENERATION_DISABLED'))).toBe(
      'text-generation-error-disabled'
    );
  });

  it.each([
    ['without the right to edit the content', 'FORBIDDEN'],
    [
      'without the right to write where the email lives',
      'MAILING_ACCESS_DENIED',
    ],
    ['without a code', undefined],
  ])('says the user may not edit the email %s', (_label, message) => {
    expect(errorKey(failure(403, message))).toBe(
      'text-generation-error-forbidden'
    );
  });

  it('keeps the other statuses', () => {
    expect(errorKey(failure(429))).toBe('text-generation-error-rate-limited');
    expect(errorKey({})).toBe('text-generation-error-network');
  });
});
