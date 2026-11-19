'use strict';

// Each Brevo provider calls the API through its own SDK client, with the key
// of its own account: the SDK's `ApiClient.instance` is shared by the process.

const SibApiV3Sdk = require('sib-api-v3-sdk');

const SendinBlueProvider = require('../../../packages/server/esp/sendinblue/sendinBlueProvider.js');

describe('the Brevo provider client', () => {
  let keys;

  beforeEach(() => {
    keys = [];
    jest
      .spyOn(SibApiV3Sdk.ApiClient.prototype, 'callApi')
      .mockImplementation(function callApi() {
        keys.push(this.authentications['api-key'].apiKey);
        return Promise.resolve({ data: {}, response: {} });
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls the API with the key of its own account, whatever other providers exist', async () => {
    const first = new SendinBlueProvider({ apiKey: 'xkeysib-first' });
    const second = new SendinBlueProvider({ apiKey: 'xkeysib-second' });

    await Promise.all([first.connectApi(), second.connectApi()]);
    await first.connectApi();

    expect(keys.sort()).toEqual([
      'xkeysib-first',
      'xkeysib-first',
      'xkeysib-second',
    ]);
    expect(
      SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey
    ).toBeUndefined();
  });
});
