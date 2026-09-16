'use strict';

jest.mock('../../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const mockCreateProvider = jest.fn();
jest.mock(
  '../../../../packages/server/integration-providers/provider-factory.js',
  () => ({
    createProvider: (...args) => mockCreateProvider(...args),
  })
);

const {
  listModelsForIntegration,
} = require('../../../../packages/server/integration-providers/ai/model-listing.service');
const cache = require('../../../../packages/server/integration-providers/ai/model-listing.cache');

function integration(overrides = {}) {
  return {
    _id: 'integration-1',
    provider: 'openai',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function providerListing(models) {
  return { listRemoteModels: jest.fn().mockResolvedValue(models) };
}

function ids(result) {
  return result.models.map((m) => m.id);
}

describe('model-listing.service', () => {
  beforeEach(() => {
    cache.clear();
    jest.clearAllMocks();
  });

  describe('merging a remote listing with the catalogue', () => {
    it('prefers the curated label over the remote one', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([{ id: 'gpt-4o', label: 'whatever the API calls it' }])
      );

      const result = await listModelsForIntegration(integration());

      expect(result.source).toBe('merged');
      expect(result.models[0]).toMatchObject({
        id: 'gpt-4o',
        label: 'GPT-4o',
        known: true,
        remote: true,
      });
    });

    // The point of listing remotely: a model released after this deploy must
    // reach the admin without a release of LePatron.
    it('keeps a model the catalogue has never heard of', async () => {
      mockCreateProvider.mockReturnValue(providerListing([{ id: 'gpt-6' }]));

      const result = await listModelsForIntegration(integration());

      expect(result.models).toContainEqual(
        expect.objectContaining({ id: 'gpt-6', known: false, remote: true })
      );
    });

    it('falls back to the id when the provider reports no label', async () => {
      mockCreateProvider.mockReturnValue(providerListing([{ id: 'gpt-6' }]));

      const result = await listModelsForIntegration(integration());
      const model = result.models.find((m) => m.id === 'gpt-6');

      expect(model.label).toBe('gpt-6');
      expect(model.name).toBe('gpt-6');
    });

    // OpenAI returns every model family at once with no type metadata.
    it('drops the non-chat noise of an OpenAI listing', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([
          { id: 'gpt-4o' },
          { id: 'text-embedding-3-small' },
          { id: 'whisper-1' },
          { id: 'dall-e-3' },
          { id: 'tts-1' },
          { id: 'omni-moderation-latest' },
          { id: 'gpt-4o-audio-preview' },
        ])
      );

      expect(ids(await listModelsForIntegration(integration()))).toEqual([
        'gpt-4o',
        'gpt-5-mini',
        'gpt-5',
        'gpt-4.1-mini',
        'gpt-4.1',
        'gpt-4o-mini',
        'gpt-4-turbo',
      ]);
    });

    it('keeps catalogue entries the provider did not report, but last', async () => {
      mockCreateProvider.mockReturnValue(providerListing([{ id: 'gpt-4o' }]));

      const result = await listModelsForIntegration(integration());

      expect(ids(result)).toEqual([
        'gpt-4o',
        'gpt-5-mini',
        'gpt-5',
        'gpt-4.1-mini',
        'gpt-4.1',
        'gpt-4o-mini',
        'gpt-4-turbo',
      ]);
      expect(result.models[0].remote).toBe(true);
      expect(result.models[1].remote).toBe(false);
    });

    it('orders live catalogue models, then unknown ones, then unseen', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([
          { id: 'o4-mini' },
          { id: 'gpt-4o-mini' },
          { id: 'gpt-zeta' },
        ])
      );

      expect(ids(await listModelsForIntegration(integration()))).toEqual([
        // reported and curated, in catalogue order
        'gpt-4o-mini',
        // reported but unknown, alphabetically
        'gpt-zeta',
        'o4-mini',
        // curated but not reported, in catalogue order, deprecated last
        'gpt-5-mini',
        'gpt-5',
        'gpt-4.1-mini',
        'gpt-4.1',
        'gpt-4o',
        'gpt-4-turbo',
      ]);
    });

    it('ignores a duplicate id in the remote listing', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([{ id: 'gpt-4o' }, { id: 'gpt-4o' }])
      );

      expect(
        ids(await listModelsForIntegration(integration())).filter(
          (id) => id === 'gpt-4o'
        )
      ).toHaveLength(1);
    });
  });

  // OpenAI publishes `shutdown_date`, Mistral `deprecation`. Using them means
  // the list of dead models stays accurate without anyone curating it.
  describe('models the provider is retiring', () => {
    const PAST = '2020-01-01';
    const FUTURE = '2099-01-01';

    it('drops a model whose shutdown date has passed', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([
          { id: 'gpt-4o' },
          { id: 'gpt-legacy', shutdownDate: PAST },
        ])
      );

      expect(ids(await listModelsForIntegration(integration()))).not.toContain(
        'gpt-legacy'
      );
    });

    it('keeps a model still scheduled for retirement, but flags it', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([{ id: 'gpt-soon', shutdownDate: FUTURE }])
      );

      const model = (await listModelsForIntegration(integration())).models.find(
        (m) => m.id === 'gpt-soon'
      );

      expect(model).toBeDefined();
      expect(model.deprecated).toBe(true);
    });

    it('sorts retiring models after the rest of their group', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([
          { id: 'gpt-aaa', shutdownDate: FUTURE },
          { id: 'gpt-zzz' },
        ])
      );

      const listed = ids(await listModelsForIntegration(integration()));

      expect(listed.indexOf('gpt-zzz')).toBeLessThan(listed.indexOf('gpt-aaa'));
    });

    it('ignores an unparseable date rather than hiding the model', async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([{ id: 'gpt-4o', shutdownDate: 'not a date' }])
      );

      expect(ids(await listModelsForIntegration(integration()))).toContain(
        'gpt-4o'
      );
    });
  });

  describe('descriptions', () => {
    it("passes through the provider's own description", async () => {
      mockCreateProvider.mockReturnValue(
        providerListing([
          { id: 'mistral-small-latest', description: 'Notre modèle rapide.' },
        ])
      );

      const model = (
        await listModelsForIntegration(integration({ provider: 'mistral' }))
      ).models.find((m) => m.id === 'mistral-small-latest');

      expect(model.description).toBe('Notre modèle rapide.');
      // The catalogue key stays alongside it: OpenAI and Anthropic send no
      // description, so the UI still needs something to fall back on.
      expect(model.descriptionKey).toBeTruthy();
    });

    it('leaves description null when the provider sends none', async () => {
      mockCreateProvider.mockReturnValue(providerListing([{ id: 'gpt-4o' }]));

      const model = (await listModelsForIntegration(integration())).models.find(
        (m) => m.id === 'gpt-4o'
      );

      expect(model.description).toBeNull();
    });
  });

  describe('degraded modes', () => {
    // A provider being unreachable must not read as "this account has no
    // models": the screen stays usable on the catalogue.
    it('falls back to the catalogue when the listing throws', async () => {
      mockCreateProvider.mockReturnValue({
        listRemoteModels: jest.fn().mockRejectedValue(new Error('401 nope')),
      });

      const result = await listModelsForIntegration(integration());

      expect(result.source).toBe('catalog');
      expect(result.error).toBe('401 nope');
      expect(ids(result)[0]).toBe('gpt-5-mini');
    });

    // Infomaniak: its /models endpoint returns names its chat API refuses.
    it('uses the catalogue alone when the provider offers no listing', async () => {
      mockCreateProvider.mockReturnValue({});

      const result = await listModelsForIntegration(
        integration({ provider: 'infomaniak' })
      );

      expect(result.source).toBe('catalog');
      expect(result.error).toBeNull();
      expect(ids(result)[0]).toBe('mistral3');
    });

    it('reports a provider that cannot even be constructed', async () => {
      mockCreateProvider.mockImplementation(() => {
        throw new Error('Infomaniak provider requires a productId');
      });

      const result = await listModelsForIntegration(
        integration({ provider: 'infomaniak' })
      );

      expect(result.error).toMatch(/productId/);
      expect(result.source).toBe('catalog');
    });

    it('returns an empty list for a provider with neither listing nor catalogue', async () => {
      mockCreateProvider.mockReturnValue({});

      const result = await listModelsForIntegration(
        integration({ provider: 'azure_openai' })
      );

      expect(result.models).toEqual([]);
      expect(result.source).toBe('catalog');
    });
  });

  describe('caching', () => {
    it('queries the provider once for two consecutive calls', async () => {
      const provider = providerListing([{ id: 'gpt-4o' }]);
      mockCreateProvider.mockReturnValue(provider);

      await listModelsForIntegration(integration());
      await listModelsForIntegration(integration());

      expect(provider.listRemoteModels).toHaveBeenCalledTimes(1);
    });

    // Editing the API key or host bumps updatedAt, which is what makes the
    // previous listing unreachable — no explicit invalidation to forget.
    it('re-queries when the integration was modified', async () => {
      const provider = providerListing([{ id: 'gpt-4o' }]);
      mockCreateProvider.mockReturnValue(provider);

      await listModelsForIntegration(integration());
      await listModelsForIntegration(
        integration({ updatedAt: new Date('2026-02-02T00:00:00Z') })
      );

      expect(provider.listRemoteModels).toHaveBeenCalledTimes(2);
    });

    it('re-queries on an explicit refresh', async () => {
      const provider = providerListing([{ id: 'gpt-4o' }]);
      mockCreateProvider.mockReturnValue(provider);

      await listModelsForIntegration(integration());
      await listModelsForIntegration(integration(), { refresh: true });

      expect(provider.listRemoteModels).toHaveBeenCalledTimes(2);
    });

    // Keeps a reloading admin from hammering an API that is down.
    it('caches a failure too', async () => {
      const provider = {
        listRemoteModels: jest.fn().mockRejectedValue(new Error('boom')),
      };
      mockCreateProvider.mockReturnValue(provider);

      await listModelsForIntegration(integration());
      const second = await listModelsForIntegration(integration());

      expect(provider.listRemoteModels).toHaveBeenCalledTimes(1);
      expect(second.error).toBe('boom');
    });

    it('does not leak one integration listing into another', async () => {
      mockCreateProvider.mockReturnValue(providerListing([{ id: 'gpt-4o' }]));
      await listModelsForIntegration(integration());

      mockCreateProvider.mockReturnValue(providerListing([{ id: 'gpt-6' }]));
      const other = await listModelsForIntegration(
        integration({ _id: 'integration-2' })
      );

      expect(ids(other)).toContain('gpt-6');
    });
  });
});
