'use strict';

const {
  validateIntegrationConfig,
} = require('../../../packages/server/integration/integration.validation.js');

// `config` is a Mixed field written as sent: these pin what each provider may
// store there, and in what shape.
describe('validateIntegrationConfig', () => {
  it('stores {} when no config is sent', () => {
    expect(validateIntegrationConfig('openai', undefined)).toEqual({});
    expect(validateIntegrationConfig('rss', null)).toEqual({});
  });

  it.each([
    ['azure_openai', { deployment: 'prod-chat', apiVersion: '2024-10-21' }],
    [
      'azure_openai',
      { reasoningModel: true, apiVersion: '2025-04-01-preview' },
    ],
    ['openai_compatible', { supportsJsonMode: true, model: 'llama-3.1-8b' }],
    ['scaleway', { supportsJsonMode: false }],
    ['ovh', { supportsJsonMode: null }],
    ['openai', { model: 'gpt-5-mini' }],
    ['rss', {}],
  ])('accepts %s %j', (provider, config) => {
    expect(validateIntegrationConfig(provider, config)).toBe(config);
  });

  it.each([
    // `..` walked up a segment of the Azure path.
    ['azure_openai', { deployment: '..' }],
    ['azure_openai', { deployment: 'a/b' }],
    ['azure_openai', { apiVersion: 'x&foo=1#' }],
    ['azure_openai', { reasoningModel: 'yes' }],
    ['openai_compatible', { supportsJsonMode: 'true' }],
    ['openai', { model: 'gpt 5' }],
    // Keys the provider does not read.
    ['openai', { deployment: 'x' }],
    ['rss', { anything: 1 }],
    ['openai', { $where: '1' }],
    // Not an object.
    ['openai', ['model']],
    ['openai', 'model'],
  ])('refuses %s %j', (provider, config) => {
    expect(() => validateIntegrationConfig(provider, config)).toThrow(
      'INTEGRATION_CONFIG_INVALID'
    );
  });
});
