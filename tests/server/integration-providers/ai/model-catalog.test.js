'use strict';

const catalog = require('../../../../packages/server/integration-providers/ai/model-catalog');

// The locale files are ES modules, so Babel hands them over under `default`.
const fr = require('../../../../packages/ui/helpers/locales/fr').default;
const en = require('../../../../packages/ui/helpers/locales/en').default;

const PROVIDERS = ['openai', 'mistral', 'infomaniak', 'anthropic', 'gemini'];

function lookup(locale, key) {
  return key
    .split('.')
    .reduce((acc, part) => (acc ? acc[part] : undefined), locale);
}

describe('model-catalog', () => {
  // Every group that never picked a model runs on these, so a change here
  // silently repoints production traffic. The test exists to make that a
  // deliberate edit rather than a side effect — which is what it just forced.
  //
  // openai: moved off gpt-4o-mini, a pinned generation with no self-updating
  //   alias to ride.
  // mistral: unchanged, and deliberately so — `-latest` already tracks the
  //   current generation (it resolves to Mistral Small 4 today).
  // infomaniak: moved off mixtral, which a live account now answers 422 for.
  //   The default was calling a model that no longer exists.
  // anthropic / gemini: both verified by a real call. Gemini's matters most —
  // every dated id its own listing advertises answers 404 for new accounts,
  // so only the `-latest` aliases are callable.
  it.each([
    ['openai', 'gpt-5-mini'],
    ['mistral', 'mistral-small-latest'],
    ['infomaniak', 'mistral3'],
    ['anthropic', 'claude-haiku-4-5-20251001'],
    ['gemini', 'gemini-flash-latest'],
  ])('%s defaults to %s', (provider, expected) => {
    expect(catalog.getCatalogDefaultModel(provider)).toBe(expected);
  });

  // Verified by calling the chat endpoint of a live Infomaniak account: these
  // three answered 200, while mixtral / llama3 / granite / gemma3n answered
  // 422. This provider has no remote listing to catch that drift, so the list
  // is the only guard.
  // Same shape of trap as Infomaniak: what the listing advertises and what the
  // API accepts differ, and only a real call tells them apart.
  it('only offers Gemini aliases, the dated ids being refused', () => {
    expect(catalog.getCatalogModels('gemini').map((m) => m.id)).toEqual([
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-pro-latest',
    ]);
  });

  it('only offers Infomaniak aliases the chat API still accepts', () => {
    expect(catalog.getCatalogModels('infomaniak').map((m) => m.id)).toEqual([
      'mistral3',
      'mistral24b',
      'qwen3',
    ]);
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

    expect(catalog.getCatalogModels('openai')[0].label).toBe('GPT-5 Mini');
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
      // Completion models: they answer on /completions and reject the
      // messages payload every caller here sends.
      'gpt-3.5-turbo-instruct',
      'gpt-3.5-turbo-instruct-0914',
      // Image model whose name starts with "chatgpt", so the positive guard
      // would otherwise wave it through.
      'chatgpt-image-latest',
    ])('filters out %s', (id) => {
      expect(catalog.passesRemoteFilter('openai', id)).toBe(false);
    });

    // The whole point of listing remotely: a model released after this deploy
    // must reach the admin without a release of LePatron.
    it.each(['gpt-4o', 'gpt-6', 'gpt-5-turbo', 'o3-mini', 'chatgpt-4o-latest'])(
      'keeps %s',
      (id) => {
        expect(catalog.passesRemoteFilter('openai', id)).toBe(true);
      }
    );

    it('keeps a catalogue entry even when a pattern would exclude it', () => {
      // Hypothetical, but the rule matters: curation beats pattern matching.
      expect(catalog.passesRemoteFilter('openai', 'gpt-4-turbo')).toBe(true);
    });

    // Gemini reports speech and image models as supporting generateContent,
    // so filtering on that method alone lets them through.
    it.each([
      'gemini-2.5-flash-preview-tts',
      'gemini-2.5-flash-image',
      'imagen-4.0-generate-001',
      'veo-3.0-generate-001',
      // Listed, but closed to new accounts: 404 when called.
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
    ])('filters %s out of a Gemini listing', (id) => {
      expect(catalog.passesRemoteFilter('gemini', id)).toBe(false);
    });

    it.each([
      'gemini-flash-latest',
      'gemini-3-flash-preview',
      'gemma-4-31b-it',
    ])('keeps %s', (id) => {
      expect(catalog.passesRemoteFilter('gemini', id)).toBe(true);
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
