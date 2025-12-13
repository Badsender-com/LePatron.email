'use strict';

const {
  injectTexts,
  validateTranslations,
  setByPath,
  deepClone,
} = require('./mosaico-text-injector');

describe('MosaicoTextInjector', () => {
  describe('setByPath', () => {
    it('should set value at simple path', () => {
      const obj = { a: 'old' };
      const result = setByPath(obj, 'a', 'new');

      expect(result).toBe(true);
      expect(obj.a).toBe('new');
    });

    it('should set value at nested path', () => {
      const obj = { a: { b: { c: 'old' } } };
      const result = setByPath(obj, 'a.b.c', 'new');

      expect(result).toBe(true);
      expect(obj.a.b.c).toBe('new');
    });

    it('should set value in array', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const result = setByPath(obj, 'items.1', 'new');

      expect(result).toBe(true);
      expect(obj.items[1]).toBe('new');
    });

    it('should set value in nested object within array', () => {
      const obj = { blocks: [{ text: 'old' }, { text: 'old2' }] };
      const result = setByPath(obj, 'blocks.0.text', 'new');

      expect(result).toBe(true);
      expect(obj.blocks[0].text).toBe('new');
    });

    it('should return false for non-existent path', () => {
      const obj = { a: 'value' };
      const result = setByPath(obj, 'b.c', 'new');

      expect(result).toBe(false);
    });

    it('should return false for out of bounds array index', () => {
      const obj = { items: ['a', 'b'] };
      const result = setByPath(obj, 'items.5', 'new');

      expect(result).toBe(false);
    });
  });

  describe('deepClone', () => {
    it('should create independent copy', () => {
      const original = { a: { b: 'value' } };
      const clone = deepClone(original);

      clone.a.b = 'modified';

      expect(original.a.b).toBe('value');
      expect(clone.a.b).toBe('modified');
    });

    it('should clone arrays', () => {
      const original = { items: [1, 2, 3] };
      const clone = deepClone(original);

      clone.items.push(4);

      expect(original.items.length).toBe(3);
      expect(clone.items.length).toBe(4);
    });
  });

  describe('injectTexts', () => {
    it('should inject email name', () => {
      const mailing = {
        name: 'Original Name',
        data: {},
      };
      const translations = {
        _name: 'Translated Name',
      };

      const { mailing: result, stats } = injectTexts(mailing, translations);

      expect(result.name).toBe('Translated Name');
      expect(stats.injected).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it('should inject text fields into data', () => {
      const mailing = {
        name: 'Test',
        data: {
          block: {
            text: 'Hello',
            buttonText: 'Click',
          },
        },
      };
      const translations = {
        'data.block.text': 'Bonjour',
        'data.block.buttonText': 'Cliquez',
      };

      const { mailing: result, stats } = injectTexts(mailing, translations);

      expect(result.data.block.text).toBe('Bonjour');
      expect(result.data.block.buttonText).toBe('Cliquez');
      expect(stats.injected).toBe(2);
    });

    it('should not mutate original mailing', () => {
      const mailing = {
        name: 'Original',
        data: { text: 'Hello' },
      };
      const translations = {
        _name: 'Translated',
        'data.text': 'Bonjour',
      };

      injectTexts(mailing, translations);

      expect(mailing.name).toBe('Original');
      expect(mailing.data.text).toBe('Hello');
    });

    it('should handle nested array structures', () => {
      const mailing = {
        name: 'Test',
        data: {
          blocks: [{ text: 'First' }, { text: 'Second' }],
        },
      };
      const translations = {
        'data.blocks.0.text': 'Premier',
        'data.blocks.1.text': 'Deuxième',
      };

      const { mailing: result, stats } = injectTexts(mailing, translations);

      expect(result.data.blocks[0].text).toBe('Premier');
      expect(result.data.blocks[1].text).toBe('Deuxième');
      expect(stats.injected).toBe(2);
    });

    it('should report failed injections', () => {
      const mailing = {
        name: 'Test',
        data: {},
      };
      const translations = {
        'data.nonexistent.field': 'Value',
      };

      const { stats } = injectTexts(mailing, translations);

      expect(stats.failed).toBe(1);
      expect(stats.failedKeys).toContain('data.nonexistent.field');
    });

    it('should handle mixed success and failure', () => {
      const mailing = {
        name: 'Test',
        data: {
          existing: { text: 'Hello' },
        },
      };
      const translations = {
        _name: 'Translated',
        'data.existing.text': 'Bonjour',
        'data.missing.field': 'Should fail',
      };

      const { mailing: result, stats } = injectTexts(mailing, translations);

      expect(result.name).toBe('Translated');
      expect(result.data.existing.text).toBe('Bonjour');
      expect(stats.injected).toBe(2);
      expect(stats.failed).toBe(1);
    });
  });

  describe('validateTranslations', () => {
    it('should return valid for matching keys', () => {
      const original = { a: 'Hello', b: 'World' };
      const translated = { a: 'Bonjour', b: 'Monde' };

      const result = validateTranslations(original, translated);

      expect(result.isValid).toBe(true);
      expect(result.missing.length).toBe(0);
      expect(result.extra.length).toBe(0);
    });

    it('should detect missing translations', () => {
      const original = { a: 'Hello', b: 'World' };
      const translated = { a: 'Bonjour' };

      const result = validateTranslations(original, translated);

      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('b');
    });

    it('should detect extra translations', () => {
      const original = { a: 'Hello' };
      const translated = { a: 'Bonjour', b: 'Extra' };

      const result = validateTranslations(original, translated);

      expect(result.isValid).toBe(false);
      expect(result.extra).toContain('b');
    });

    it('should report counts', () => {
      const original = { a: 'A', b: 'B', c: 'C' };
      const translated = { a: 'A2', b: 'B2' };

      const result = validateTranslations(original, translated);

      expect(result.originalCount).toBe(3);
      expect(result.translatedCount).toBe(2);
    });
  });
});
