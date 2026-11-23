'use strict';

// "Duplicate and translate" tells the user why the AI refused, in their
// language, never with the server's error code.

const { loadVueComponent } = require('../load-vue-component.js');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

const component = loadVueComponent(
  'components/mailings/modal-duplicate-translate.vue',
  { vuex: { mapMutations: () => ({}) } }
);
const { translateErrorMessage } = component.methods;

// $t as a stub: the key, then its parameters.
const vm = { $t: (key, params) => (params ? [key, params] : key) };
const messageFor = (response) => translateErrorMessage.call(vm, { response });

describe('modal-duplicate-translate error message', () => {
  it('says how many minutes to wait when the AI rate limit refuses', () => {
    expect(
      messageFor({
        status: 429,
        headers: { 'retry-after': '42' },
        data: { message: 'AI_RATE_LIMITED' },
      })
    ).toEqual(['translation.rateLimitedMinutes', { minutes: 1 }]);
  });

  it('says how many hours to wait when a day ceiling refuses', () => {
    expect(
      messageFor({ status: 429, headers: { 'retry-after': '5400' } })
    ).toEqual(['translation.rateLimitedHours', { hours: 2 }]);
  });

  it('says to try again later when the wait is not given', () => {
    expect(messageFor({ status: 429, headers: {} })).toBe(
      'global.errors.tooManyRequests'
    );
  });

  it('says the request is too large on 413', () => {
    expect(
      messageFor({ status: 413, data: { message: 'AI_PAYLOAD_TOO_LARGE' } })
    ).toBe('translation.payloadTooLarge');
  });

  it('falls back to the generic error without a message', () => {
    expect(messageFor({ status: 500 })).toBe('global.errors.errorOccured');
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])('has the messages in %s', (_, locale) => {
    [
      'rateLimitedMinutes',
      'rateLimitedHours',
      'payloadTooLarge',
    ].forEach((key) =>
      expect(locale.translation[key]).toEqual(expect.any(String))
    );
  });
});
