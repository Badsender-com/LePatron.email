'use strict';

const {
  protectVariables,
  restoreVariables,
  containsVariables,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_SUFFIX,
} = require('./variable-placeholder.utils.js');

describe('Variable Placeholder Utils', () => {
  describe('protectVariables', () => {
    it('should protect ESP variables (%%VAR%%)', () => {
      const text = 'Hello %%FIRSTNAME%%, welcome to %%COMPANY%%!';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).not.toContain('%%FIRSTNAME%%');
      expect(protectedText).not.toContain('%%COMPANY%%');
      expect(protectedText).toContain(`${PLACEHOLDER_PREFIX}0${PLACEHOLDER_SUFFIX}`);
      expect(protectedText).toContain(`${PLACEHOLDER_PREFIX}1${PLACEHOLDER_SUFFIX}`);
      expect(Object.keys(placeholderMap)).toHaveLength(2);
    });

    it('should protect Handlebars variables ({{var}})', () => {
      const text = 'Click {{link}} to {{action}}';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).not.toContain('{{link}}');
      expect(protectedText).not.toContain('{{action}}');
      expect(Object.keys(placeholderMap)).toHaveLength(2);
    });

    it('should protect bracket variables ([[var]])', () => {
      const text = 'Hello [[NAME]], your code is [[CODE]]';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).not.toContain('[[NAME]]');
      expect(protectedText).not.toContain('[[CODE]]');
      expect(Object.keys(placeholderMap)).toHaveLength(2);
    });

    it('should protect badsender tags', () => {
      const text = 'Click here to <badsender-unsubscribe>unsubscribe</badsender-unsubscribe>';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).not.toContain('<badsender-unsubscribe>');
      expect(Object.keys(placeholderMap)).toHaveLength(1);
    });

    it('should protect self-closing badsender tags', () => {
      const text = 'View in browser: <badsender-mirror />';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).not.toContain('<badsender-mirror');
      expect(Object.keys(placeholderMap)).toHaveLength(1);
    });

    it('should protect mixed variable types', () => {
      const text = 'Hi %%FIRSTNAME%%, click {{link}} or [[URL]]';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).not.toContain('%%FIRSTNAME%%');
      expect(protectedText).not.toContain('{{link}}');
      expect(protectedText).not.toContain('[[URL]]');
      expect(Object.keys(placeholderMap)).toHaveLength(3);
    });

    it('should return empty map for text without variables', () => {
      const text = 'Hello world, this is plain text.';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).toBe(text);
      expect(Object.keys(placeholderMap)).toHaveLength(0);
    });

    it('should handle null/undefined input', () => {
      expect(protectVariables(null)).toEqual({ protectedText: '', placeholderMap: {} });
      expect(protectVariables(undefined)).toEqual({ protectedText: '', placeholderMap: {} });
      expect(protectVariables('')).toEqual({ protectedText: '', placeholderMap: {} });
    });

    it('should handle Handlebars block helpers', () => {
      const text = '{{#if condition}}Show this{{/if}}';
      const { protectedText, placeholderMap } = protectVariables(text);

      expect(protectedText).not.toContain('{{#if condition}}');
      expect(protectedText).not.toContain('{{/if}}');
      expect(Object.keys(placeholderMap)).toHaveLength(2);
    });
  });

  describe('restoreVariables', () => {
    it('should restore protected variables', () => {
      const original = 'Hello %%FIRSTNAME%%, welcome!';
      const { protectedText, placeholderMap } = protectVariables(original);

      // Simulate translation (text changes but placeholders remain)
      const translated = protectedText.replace('Hello', 'Bonjour').replace('welcome', 'bienvenue');
      const restored = restoreVariables(translated, placeholderMap);

      expect(restored).toContain('%%FIRSTNAME%%');
      expect(restored).toContain('Bonjour');
      expect(restored).toContain('bienvenue');
    });

    it('should handle empty placeholder map', () => {
      const text = 'Hello world';
      const restored = restoreVariables(text, {});

      expect(restored).toBe(text);
    });

    it('should handle null/undefined input', () => {
      expect(restoreVariables(null, {})).toBe('');
      expect(restoreVariables(undefined, {})).toBe('');
      expect(restoreVariables('', {})).toBe('');
    });

    it('should restore multiple occurrences of same placeholder', () => {
      // Edge case: if somehow the same placeholder appears twice
      const placeholderMap = {
        [`${PLACEHOLDER_PREFIX}0${PLACEHOLDER_SUFFIX}`]: '%%VAR%%',
      };
      const text = `${PLACEHOLDER_PREFIX}0${PLACEHOLDER_SUFFIX} and ${PLACEHOLDER_PREFIX}0${PLACEHOLDER_SUFFIX}`;
      const restored = restoreVariables(text, placeholderMap);

      expect(restored).toBe('%%VAR%% and %%VAR%%');
    });
  });

  describe('containsVariables', () => {
    it('should return true for ESP variables', () => {
      expect(containsVariables('Hello %%NAME%%')).toBe(true);
    });

    it('should return true for Handlebars variables', () => {
      expect(containsVariables('Hello {{name}}')).toBe(true);
    });

    it('should return true for bracket variables', () => {
      expect(containsVariables('Hello [[name]]')).toBe(true);
    });

    it('should return true for badsender tags', () => {
      expect(containsVariables('<badsender-mirror />')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(containsVariables('Hello world')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(containsVariables(null)).toBe(false);
      expect(containsVariables(undefined)).toBe(false);
      expect(containsVariables('')).toBe(false);
    });
  });

  describe('round-trip protection and restoration', () => {
    const testCases = [
      'Hello %%FIRSTNAME%% %%LASTNAME%%!',
      'Click {{link}} to unsubscribe',
      'Your code is [[CODE]]',
      '<badsender-unsubscribe>Click here</badsender-unsubscribe>',
      'Hi %%NAME%%, visit {{url}} or use [[CODE]]',
      'No variables here',
      '',
    ];

    testCases.forEach((original) => {
      it(`should round-trip: "${original.substring(0, 40)}..."`, () => {
        const { protectedText, placeholderMap } = protectVariables(original);
        const restored = restoreVariables(protectedText, placeholderMap);

        expect(restored).toBe(original);
      });
    });
  });
});
