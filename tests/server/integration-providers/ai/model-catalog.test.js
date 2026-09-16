'use strict';

const catalog = require('../../../../packages/server/integration-providers/ai/model-catalog');

// The locale files are ES modules, so Babel hands them over under `default`.
const fr = require('../../../../packages/ui/helpers/locales/fr').default;
const en = require('../../../../packages/ui/helpers/locales/en').default;

const PROVIDERS = ['openai', 'mistral', 'infomaniak'];

function lookup(locale, key) {
  return key
    .split('.')
    .reduce((acc, part) => (acc ? acc[part] : undefined), locale);
}

describe('model-catalog', () => {
  // These are the values that were hardcoded in the provider classes. Every
  // group that never picked a model runs on them today, so a change here
  // silently repoints production traffic to another model.
  it.each([
    ['openai', 'gpt-4o-mini'],
    ['mistral', 'mistral-small-latest'],
    ['infomaniak', 'mixtral'],
  ])('%s still defaults to %s', (provider, expected) => {
    expect(catalog.getCatalogDefaultModel(provider)).toBe(expected);
  });

  it.each(PROVIDERS)('%s default is itself a catalogue entry', (provider) => {
    const id = catalog.getCatalogDefaultModel(provider);

    expect(catalog.isModelKnown(provider, id)).toBe(true);
  });

  it.each(PROVIDERS)('%s has no duplicate model id', (provider) => {
    const ids = catalog.getCatalogModels(provider).map((m) => m.id);

    expect(ids).toHaveLength(new Set(ids).size);
  });

  it.each(PROVIDERS)(
    '%s models are returned in ascending order',
    (provider) => {
      const orders = catalog.getCatalogModels(provider).map((m) => m.order);

      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  );

  // Nothing checked these keys before: a typo surfaced as a blank qualifier in
  // the select, in one language only.
  it.each(PROVIDERS)('%s description keys resolve in fr and en', (provider) => {
    for (const model of catalog.getCatalogModels(provider)) {
      if (!model.descriptionKey) continue;
      expect(lookup(fr, model.descriptionKey)).toBeTruthy();
      expect(lookup(en, model.descriptionKey)).toBeTruthy();
    }
  });

  it('returns an empty list for an unknown provider', () => {
    expect(catalog.getCatalogModels('nope')).toEqual([]);
    expect(catalog.getCatalogDefaultModel('nope')).toBeNull();
    expect(catalog.getCatalogEntry('nope', 'x')).toBeNull();
  });

  it('hands out copies, so callers cannot mutate the catalogue', () => {
    catalog.getCatalogModels('openai')[0].label = 'mutated';

    expect(catalog.getCatalogModels('openai')[0].label).toBe('GPT-4o Mini');
  });

  describe('passesRemoteFilter', () => {
    // OpenAI's /v1/models mixes every model family with no type metadata.
    it.each([
      'text-embedding-3-small',
      'text-embedding-ada-002',
      'whisper-1',
      'dall-e-3',
      'gpt-image-1',
      'tts-1-hd',
      'omni-moderation-latest',
      'davinci-002',
      'gpt-4o-audio-preview',
      'gpt-4o-realtime-preview',
      'gpt-4o-transcribe',
    ])('filters out %s', (id) => {
      expect(catalog.passesRemoteFilter('openai', id)).toBe(false);
    });

    // The whole point of listing remotely: a model released after this deploy
    // must reach the admin without a release of LePatron.
    it.each(['gpt-4o', 'gpt-5', 'gpt-5-turbo', 'o3-mini', 'chatgpt-4o-latest'])(
      'keeps %s',
      (id) => {
        expect(catalog.passesRemoteFilter('openai', id)).toBe(true);
      }
    );

    it('keeps a catalogue entry even when a pattern would exclude it', () => {
      // Hypothetical, but the rule matters: curation beats pattern matching.
      expect(catalog.passesRemoteFilter('openai', 'gpt-4-turbo')).toBe(true);
    });

    // Azure deployment names and self-hosted endpoints are chosen by the
    // customer: any filter we applied there would be a guess.
    it.each(['my-deployment', 'llama-3.1-8b', 'anything at all'])(
      'keeps %j for a provider with no filter',
      (id) => {
        expect(catalog.passesRemoteFilter('azure_openai', id)).toBe(true);
      }
    );
  });
});
