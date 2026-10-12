'use strict';

const mongoose = require('mongoose');

const IntegrationSchema = require('../../../packages/server/integration/integration.schema.js');

// Schema-level tests, deliberately not mocked: the service tests stub
// `Integrations.create`, so they assert what we *ask* Mongoose to store, never
// what it actually keeps. `strict` mode silently drops undeclared fields, which
// is invisible from a mocked create — productId went missing that way.
describe('IntegrationSchema', () => {
  const Integration = mongoose.model(
    'IntegrationSchemaTest',
    IntegrationSchema
  );

  function build(overrides) {
    return new Integration({
      name: 'Test',
      type: 'ai',
      provider: 'infomaniak',
      _company: new mongoose.Types.ObjectId(),
      apiKey: 'key',
      ...overrides,
    });
  }

  // InfomaniakProvider builds its base URL from productId and throws
  // CONFIG_ERROR without it: dropping the field makes the provider unusable,
  // not merely degraded.
  it('keeps productId', () => {
    expect(build({ productId: '12345' }).toObject().productId).toBe('12345');
  });

  it('keeps a Mixed config untouched', () => {
    const config = { deployment: 'my-deployment', apiVersion: '2024-10-21' };

    expect(build({ config }).toObject().config).toEqual(config);
  });

  it('rejects an unknown provider', async () => {
    await expect(build({ provider: 'nope' }).validate()).rejects.toThrow();
  });

  it('requires an apiKey for ai integrations', async () => {
    const integration = build({});
    integration.apiKey = undefined;

    await expect(integration.validate()).rejects.toThrow();
  });

  // Public RSS feeds need no credentials.
  it('does not require an apiKey for data_feed integrations', async () => {
    const integration = build({ type: 'data_feed', provider: 'rss' });
    integration.apiKey = undefined;

    await expect(integration.validate()).resolves.toBeUndefined();
  });
});
