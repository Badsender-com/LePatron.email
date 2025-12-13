'use strict';

// Mock dependencies before requiring the service
jest.mock('../ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn(),
}));

jest.mock('../integration-providers/provider-factory', () => ({
  createProvider: jest.fn(),
}));

const translationService = require('./translation.service');
const aiFeatureService = require('../ai-feature/ai-feature.service');
const ProviderFactory = require('../integration-providers/provider-factory');

describe('TranslationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('translateMailing', () => {
    const mockGroupId = 'group-123';

    it('should translate mailing successfully', async () => {
      const mockIntegration = {
        _id: 'integration-123',
        provider: 'openai',
        apiKey: 'test-key',
        isActive: true,
      };
      const mockFeature = {
        featureType: 'translation',
        isActive: true,
        config: {
          availableLanguages: ['fr', 'en', 'es'],
        },
      };
      const mockProvider = {
        translateBatch: jest.fn().mockResolvedValue({
          _name: 'Discover our news',
          'data.block.text': 'Hello world',
        }),
      };

      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
        integration: mockIntegration,
        feature: mockFeature,
      });
      ProviderFactory.createProvider.mockReturnValue(mockProvider);

      const mailing = {
        name: 'Découvrez nos nouveautés',
        data: {
          block: {
            text: 'Bonjour le monde',
          },
        },
      };

      const result = await translationService.translateMailing({
        groupId: mockGroupId,
        mailing,
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result.mailing.name).toBe('Discover our news');
      expect(result.mailing.data.block.text).toBe('Hello world');
      expect(result.stats.fieldsExtracted).toBe(2);
    });

    it('should throw error when no integration configured', async () => {
      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue(null);

      const mailing = {
        name: 'Test',
        data: {},
      };

      await expect(
        translationService.translateMailing({
          groupId: mockGroupId,
          mailing,
          sourceLanguage: 'fr',
          targetLanguage: 'en',
        })
      ).rejects.toThrow('NO_INTEGRATION_FOR_FEATURE');
    });

    it('should throw error when target language not allowed', async () => {
      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
        integration: { _id: 'int-123' },
        feature: {
          config: {
            availableLanguages: ['fr', 'en'],
          },
        },
      });

      const mailing = {
        name: 'Test',
        data: {},
      };

      await expect(
        translationService.translateMailing({
          groupId: mockGroupId,
          mailing,
          sourceLanguage: 'fr',
          targetLanguage: 'zh', // Chinese not in available languages
        })
      ).rejects.toThrow('Target language \'zh\' is not configured');
    });

    it('should return original mailing when no text to translate', async () => {
      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
        integration: { _id: 'int-123' },
        feature: { config: { availableLanguages: [] } },
      });

      const mailing = {
        name: '', // Empty name
        data: {
          block: {
            color: '#ff0000', // Not a text field
          },
        },
      };

      const result = await translationService.translateMailing({
        groupId: mockGroupId,
        mailing,
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result.stats.fieldsTranslated).toBe(0);
    });

    it('should handle provider errors', async () => {
      const mockProvider = {
        translateBatch: jest
          .fn()
          .mockRejectedValue(new Error('API rate limit')),
      };

      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
        integration: { _id: 'int-123', provider: 'openai' },
        feature: { config: { availableLanguages: [] } },
      });
      ProviderFactory.createProvider.mockReturnValue(mockProvider);

      const mailing = {
        name: 'Test Email',
        data: {},
      };

      await expect(
        translationService.translateMailing({
          groupId: mockGroupId,
          mailing,
          sourceLanguage: 'fr',
          targetLanguage: 'en',
        })
      ).rejects.toThrow('TRANSLATION_PROVIDER_ERROR');
    });
  });

  describe('translateText', () => {
    it('should translate single text', async () => {
      const mockProvider = {
        translateText: jest.fn().mockResolvedValue('Hello'),
      };

      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
        integration: { _id: 'int-123', provider: 'openai' },
        feature: { config: { availableLanguages: ['fr', 'en'] } },
      });
      ProviderFactory.createProvider.mockReturnValue(mockProvider);

      const result = await translationService.translateText({
        groupId: 'group-123',
        text: 'Bonjour',
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result).toBe('Hello');
      expect(mockProvider.translateText).toHaveBeenCalledWith({
        text: 'Bonjour',
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return available languages when configured', async () => {
      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
        integration: { _id: 'int-123' },
        feature: {
          config: {
            availableLanguages: ['fr', 'en', 'es', 'de'],
            defaultSourceLanguage: 'fr',
          },
        },
      });

      const result = await translationService.getAvailableLanguages({
        groupId: 'group-123',
      });

      expect(result.isAvailable).toBe(true);
      expect(result.languages).toEqual(['fr', 'en', 'es', 'de']);
      expect(result.defaultSourceLanguage).toBe('fr');
    });

    it('should return not available when no integration', async () => {
      aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue(null);

      const result = await translationService.getAvailableLanguages({
        groupId: 'group-123',
      });

      expect(result.isAvailable).toBe(false);
      expect(result.languages).toEqual([]);
    });
  });

  describe('detectSourceLanguage', () => {
    it('should detect language from HTML lang attribute', () => {
      const mailing = {
        previewHtml: '<html lang="fr"><body>Contenu</body></html>',
      };

      const result = translationService.detectSourceLanguage(mailing);

      expect(result).toBe('fr');
    });

    it('should detect language with different quote styles', () => {
      const mailing = {
        previewHtml: '<html lang=\'en\'><body>Content</body></html>',
      };

      const result = translationService.detectSourceLanguage(mailing);

      expect(result).toBe('en');
    });

    it('should return auto when no lang attribute', () => {
      const mailing = {
        previewHtml: '<html><body>Content</body></html>',
      };

      const result = translationService.detectSourceLanguage(mailing);

      expect(result).toBe('auto');
    });

    it('should return auto when no previewHtml', () => {
      const mailing = {};

      const result = translationService.detectSourceLanguage(mailing);

      expect(result).toBe('auto');
    });

    it('should handle uppercase lang attribute', () => {
      const mailing = {
        previewHtml: '<HTML LANG="DE"><body>Inhalt</body></HTML>',
      };

      const result = translationService.detectSourceLanguage(mailing);

      expect(result).toBe('de');
    });
  });
});
