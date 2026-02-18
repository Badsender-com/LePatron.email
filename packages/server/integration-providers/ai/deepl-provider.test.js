'use strict';

const DeepLProvider = require('./deepl-provider');

// Mock deepl-node
jest.mock('deepl-node', () => {
  const mockTranslateText = jest.fn();
  const mockGetUsage = jest.fn();
  const mockGetSourceLanguages = jest.fn();
  const mockGetTargetLanguages = jest.fn();

  return {
    DeepLClient: jest.fn().mockImplementation(() => ({
      translateText: mockTranslateText,
      getUsage: mockGetUsage,
      getSourceLanguages: mockGetSourceLanguages,
      getTargetLanguages: mockGetTargetLanguages,
    })),
    __mocks__: {
      mockTranslateText,
      mockGetUsage,
      mockGetSourceLanguages,
      mockGetTargetLanguages,
    },
  };
});

// Mock variable-placeholder utils
jest.mock('../../translation/variable-placeholder.utils.js', () => ({
  protectVariables: jest.fn((text) => ({
    protectedText: text,
    placeholderMap: {},
  })),
  restoreVariables: jest.fn((text) => text),
}));

const deepl = require('deepl-node');
const {
  protectVariables,
  restoreVariables,
} = require('../../translation/variable-placeholder.utils.js');

describe('DeepLProvider', () => {
  let provider;
  const mockIntegration = {
    provider: 'deepl',
    apiKey: 'deepl-test-key-12345:fx',
    config: {},
  };

  beforeEach(() => {
    provider = new DeepLProvider(mockIntegration);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default formality', () => {
      expect(provider.formality).toBe('default');
    });

    it('should use configured formality', () => {
      const customIntegration = {
        ...mockIntegration,
        config: { formality: 'more' },
      };
      const customProvider = new DeepLProvider(customIntegration);

      expect(customProvider.formality).toBe('more');
    });

    it('should have a DeepL client instance', () => {
      // The client is created in constructor, verify it exists
      expect(provider.client).toBeDefined();
      expect(provider.client.translateText).toBeDefined();
    });
  });

  describe('getDefaultTranslationModel', () => {
    it('should return null (DeepL does not use models)', () => {
      expect(provider.getDefaultTranslationModel()).toBeNull();
    });
  });

  describe('getAvailableModels', () => {
    it('should return empty array (DeepL does not use models)', async () => {
      const result = await provider.getAvailableModels();
      expect(result).toEqual([]);
    });
  });

  describe('validateCredentials', () => {
    it('should return true when getUsage succeeds', async () => {
      deepl.__mocks__.mockGetUsage.mockResolvedValueOnce({
        character: { count: 1000, limit: 500000 },
      });

      const result = await provider.validateCredentials();

      expect(result).toBe(true);
      expect(deepl.__mocks__.mockGetUsage).toHaveBeenCalled();
    });

    it('should return false when getUsage fails', async () => {
      deepl.__mocks__.mockGetUsage.mockRejectedValueOnce(
        new Error('Authorization failed')
      );

      const result = await provider.validateCredentials();

      expect(result).toBe(false);
    });
  });

  describe('getUsage', () => {
    it('should return usage statistics', async () => {
      deepl.__mocks__.mockGetUsage.mockResolvedValueOnce({
        character: {
          count: 10000,
          limit: 500000,
          limitReached: () => false,
        },
      });

      const result = await provider.getUsage();

      expect(result).toEqual({
        characterCount: 10000,
        characterLimit: 500000,
        limitReached: false,
      });
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return source and target languages', async () => {
      deepl.__mocks__.mockGetSourceLanguages.mockResolvedValueOnce([
        { code: 'EN', name: 'English' },
        { code: 'FR', name: 'French' },
      ]);
      deepl.__mocks__.mockGetTargetLanguages.mockResolvedValueOnce([
        { code: 'EN-US', name: 'English (US)', supportsFormality: true },
        { code: 'FR', name: 'French', supportsFormality: true },
        { code: 'ZH', name: 'Chinese', supportsFormality: false },
      ]);

      const result = await provider.getAvailableLanguages();

      expect(result.source).toEqual([
        { code: 'EN', name: 'English' },
        { code: 'FR', name: 'French' },
      ]);
      expect(result.target).toEqual([
        { code: 'EN-US', name: 'English (US)', supportsFormality: true },
        { code: 'FR', name: 'French', supportsFormality: true },
        { code: 'ZH', name: 'Chinese', supportsFormality: false },
      ]);
    });
  });

  describe('translateBatch', () => {
    it('should translate batch of texts', async () => {
      deepl.__mocks__.mockTranslateText.mockResolvedValueOnce([
        { text: 'Hello!' },
        { text: 'Good morning' },
      ]);

      const result = await provider.translateBatch({
        texts: {
          greeting: 'Bonjour !',
          morning: 'Bon matin',
        },
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result).toEqual({
        greeting: 'Hello!',
        morning: 'Good morning',
      });
      expect(protectVariables).toHaveBeenCalledTimes(2);
      expect(restoreVariables).toHaveBeenCalledTimes(2);
    });

    it('should return empty object for empty input', async () => {
      const result = await provider.translateBatch({
        texts: {},
        sourceLanguage: 'fr',
        targetLanguage: 'en',
      });

      expect(result).toEqual({});
      expect(deepl.__mocks__.mockTranslateText).not.toHaveBeenCalled();
    });

    it('should use null for auto source language', async () => {
      deepl.__mocks__.mockTranslateText.mockResolvedValueOnce([
        { text: 'Bonjour' },
      ]);

      await provider.translateBatch({
        texts: { text: 'Hello' },
        sourceLanguage: 'auto',
        targetLanguage: 'fr',
      });

      expect(deepl.__mocks__.mockTranslateText).toHaveBeenCalledWith(
        ['Hello'],
        null,
        'FR',
        expect.objectContaining({
          preserveFormatting: true,
        })
      );
    });

    it('should pass context when provided', async () => {
      deepl.__mocks__.mockTranslateText.mockResolvedValueOnce([
        { text: 'Bonjour' },
      ]);

      await provider.translateBatch({
        texts: { text: 'Hello' },
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        context: 'This is an email newsletter about technology.',
      });

      // Note: source language is passed as-is, only target is normalized to uppercase
      expect(deepl.__mocks__.mockTranslateText).toHaveBeenCalledWith(
        ['Hello'],
        'en',
        'FR',
        expect.objectContaining({
          context: 'This is an email newsletter about technology.',
          preserveFormatting: true,
        })
      );
    });

    it('should pass formality when configured', async () => {
      const formalProvider = new DeepLProvider({
        ...mockIntegration,
        config: { formality: 'more' },
      });

      deepl.__mocks__.mockTranslateText.mockResolvedValueOnce([
        { text: 'Bonjour' },
      ]);

      await formalProvider.translateBatch({
        texts: { text: 'Hello' },
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      });

      // Note: source language is passed as-is, only target is normalized to uppercase
      expect(deepl.__mocks__.mockTranslateText).toHaveBeenCalledWith(
        expect.any(Array),
        'en',
        'FR',
        expect.objectContaining({
          formality: 'more',
        })
      );
    });

    it('should handle single result (non-array)', async () => {
      // DeepL returns single object when translating one text
      deepl.__mocks__.mockTranslateText.mockResolvedValueOnce({
        text: 'Bonjour',
      });

      const result = await provider.translateBatch({
        texts: { greeting: 'Hello' },
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      });

      expect(result).toEqual({ greeting: 'Bonjour' });
    });
  });

  describe('translateText', () => {
    it('should translate single text', async () => {
      deepl.__mocks__.mockTranslateText.mockResolvedValueOnce([
        { text: 'Bonjour' },
      ]);

      const result = await provider.translateText({
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      });

      expect(result).toBe('Bonjour');
    });
  });

  describe('_normalizeTargetLanguage', () => {
    it('should convert to uppercase', () => {
      expect(provider._normalizeTargetLanguage('fr')).toBe('FR');
    });

    it('should map EN to EN-US', () => {
      expect(provider._normalizeTargetLanguage('en')).toBe('EN-US');
    });

    it('should map PT to PT-PT', () => {
      expect(provider._normalizeTargetLanguage('pt')).toBe('PT-PT');
    });

    it('should map ZH to ZH-HANS', () => {
      expect(provider._normalizeTargetLanguage('zh')).toBe('ZH-HANS');
    });

    it('should handle null/undefined', () => {
      expect(provider._normalizeTargetLanguage(null)).toBeNull();
      expect(provider._normalizeTargetLanguage(undefined)).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw specific error for invalid API key', async () => {
      deepl.__mocks__.mockTranslateText.mockRejectedValueOnce(
        new Error('Authorization failed')
      );

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toThrow('DeepL API key is invalid');
    });

    it('should throw specific error for quota exceeded', async () => {
      deepl.__mocks__.mockTranslateText.mockRejectedValueOnce(
        new Error('Quota exceeded')
      );

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toThrow('DeepL quota exceeded');
    });

    it('should rethrow other errors', async () => {
      deepl.__mocks__.mockTranslateText.mockRejectedValueOnce(
        new Error('Some other error')
      );

      await expect(
        provider.translateBatch({
          texts: { text: 'Hello' },
          sourceLanguage: 'en',
          targetLanguage: 'fr',
        })
      ).rejects.toThrow('Some other error');
    });
  });
});
