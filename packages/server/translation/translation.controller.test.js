'use strict';

jest.mock('./translation.service', () => ({
  translateBlockContent: jest.fn(),
  translateText: jest.fn(),
}));
jest.mock('./preview-html-updater', () => ({
  updatePreviewWithTranslations: jest.fn(),
}));
jest.mock('./translation-jobs', () => ({}));
jest.mock('../mailing/mailing.service', () => ({}));
jest.mock('../common/models.common', () => ({ Templates: {} }));
jest.mock('../utils/logger.js', () => ({ log: jest.fn() }));

const translationService = require('./translation.service');
const controller = require('./translation.controller');
const ERROR_CODES = require('../constant/error-codes');

const baseReq = (body) => ({
  user: { group: { id: '507f1f77bcf86cd799439001' } },
  body,
});

async function callAndCatch(handler, req) {
  const res = { json: jest.fn() };
  try {
    await handler(req, res);
    return { ok: true, res };
  } catch (err) {
    return { ok: false, err };
  }
}

describe('translation.controller — L1 caps', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('translateBlock', () => {
    it('accepts a normal block under the size and key caps', async () => {
      translationService.translateBlockContent.mockResolvedValue({
        title: 'Bonjour',
      });
      const req = baseReq({
        blockContent: { title: 'Hello' },
        targetLanguage: 'fr',
      });
      const { ok } = await callAndCatch(controller.translateBlock, req);
      expect(ok).toBe(true);
      expect(translationService.translateBlockContent).toHaveBeenCalled();
    });

    it('REJECTS with 413 when serialized payload exceeds 50 KB', async () => {
      // Build a payload that serializes to > 50 KB
      const huge = 'x'.repeat(60 * 1024);
      const req = baseReq({
        blockContent: { huge },
        targetLanguage: 'fr',
      });
      const { ok, err } = await callAndCatch(controller.translateBlock, req);
      expect(ok).toBe(false);
      expect(err.status).toBe(413);
      expect(err.message).toBe(ERROR_CODES.TRANSLATION_INVALID_BLOCK_CONTENT);
      expect(translationService.translateBlockContent).not.toHaveBeenCalled();
    });

    it('REJECTS with 413 when the block has > 100 top-level keys', async () => {
      const obj = {};
      for (let i = 0; i < 200; i += 1) obj[`k${i}`] = 'v';
      const req = baseReq({ blockContent: obj, targetLanguage: 'fr' });
      const { ok, err } = await callAndCatch(controller.translateBlock, req);
      expect(ok).toBe(false);
      expect(err.status).toBe(413);
      expect(translationService.translateBlockContent).not.toHaveBeenCalled();
    });

    it('rejects with 400 when blockContent is missing or not an object', async () => {
      const req = baseReq({ blockContent: null, targetLanguage: 'fr' });
      const { ok, err } = await callAndCatch(controller.translateBlock, req);
      expect(ok).toBe(false);
      expect(err.status).toBe(400);
    });
  });

  describe('translateText', () => {
    it('accepts a normal-length text', async () => {
      translationService.translateText.mockResolvedValue('Bonjour');
      const req = baseReq({ text: 'Hello', targetLanguage: 'fr' });
      const { ok } = await callAndCatch(controller.translateText, req);
      expect(ok).toBe(true);
    });

    it('REJECTS with 413 when text exceeds 10 000 chars', async () => {
      const req = baseReq({
        text: 'a'.repeat(20000),
        targetLanguage: 'fr',
      });
      const { ok, err } = await callAndCatch(controller.translateText, req);
      expect(ok).toBe(false);
      expect(err.status).toBe(413);
      expect(translationService.translateText).not.toHaveBeenCalled();
    });

    it('REJECTS with 413 when text is not a string', async () => {
      const req = baseReq({ text: { not: 'a string' }, targetLanguage: 'fr' });
      const { ok, err } = await callAndCatch(controller.translateText, req);
      expect(ok).toBe(false);
      expect(err.status).toBe(413);
    });
  });
});
