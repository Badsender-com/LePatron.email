'use strict';

const {
  updatePreviewWithTranslations,
} = require('../../../packages/server/translation/preview-html-updater');

describe('updatePreviewWithTranslations', () => {
  describe('input validation', () => {
    it('returns input when previewHtml is falsy', () => {
      expect(updatePreviewWithTranslations('', {}, {})).toBe('');
      expect(updatePreviewWithTranslations(null, {}, {})).toBeNull();
      expect(updatePreviewWithTranslations(undefined, {}, {})).toBeUndefined();
    });

    it('returns input when previewHtml is not a string', () => {
      expect(updatePreviewWithTranslations(42, {}, {})).toBe(42);
    });

    it('returns input when originalTexts or translations are missing', () => {
      expect(updatePreviewWithTranslations('<p>hi</p>', null, {})).toBe(
        '<p>hi</p>'
      );
      expect(updatePreviewWithTranslations('<p>hi</p>', {}, null)).toBe(
        '<p>hi</p>'
      );
    });
  });

  describe('Pass 1 — direct text replacement', () => {
    it('replaces a single body text', () => {
      const html = '<p>Hello world</p>';
      const out = updatePreviewWithTranslations(
        html,
        { 'block.text': 'Hello world' },
        { 'block.text': 'Bonjour monde' }
      );
      expect(out).toBe('<p>Bonjour monde</p>');
    });

    it('replaces multiple different texts in one pass', () => {
      const html = '<h1>Welcome</h1><p>Click here</p><a>Learn more</a>';
      const out = updatePreviewWithTranslations(
        html,
        { a: 'Welcome', b: 'Click here', c: 'Learn more' },
        { a: 'Bienvenue', b: 'Cliquez ici', c: 'En savoir plus' }
      );
      expect(out).toBe(
        '<h1>Bienvenue</h1><p>Cliquez ici</p><a>En savoir plus</a>'
      );
    });

    it('replaces every occurrence of a repeated text', () => {
      const html = '<a>More</a><a>More</a><a>More</a>';
      const out = updatePreviewWithTranslations(
        html,
        { k: 'More' },
        { k: 'Plus' }
      );
      expect(out).toBe('<a>Plus</a><a>Plus</a><a>Plus</a>');
    });

    it('skips entries where original and translation are identical', () => {
      const html = '<p>Logo</p><p>Hello</p>';
      const out = updatePreviewWithTranslations(
        html,
        { a: 'Logo', b: 'Hello' },
        { a: 'Logo', b: 'Bonjour' }
      );
      expect(out).toBe('<p>Logo</p><p>Bonjour</p>');
    });

    it('skips entries with empty values', () => {
      const html = '<p>Hello</p>';
      const out = updatePreviewWithTranslations(
        html,
        { a: '', b: 'Hello' },
        { a: 'Bonjour', b: 'Bonjour' }
      );
      // "Hello" -> "Bonjour", and the empty original is ignored
      expect(out).toBe('<p>Bonjour</p>');
    });
  });

  describe('longest-match wins (substring collision)', () => {
    it('translates the longer text first so its prefix is not consumed', () => {
      // "Bon" is a prefix of "Bonjour". If we naively replaced "Bon" first
      // we would corrupt the longer match.
      const html = '<p>Bonjour</p><p>Bon</p>';
      const out = updatePreviewWithTranslations(
        html,
        { short: 'Bon', long: 'Bonjour' },
        { short: 'Good', long: 'Hello' }
      );
      expect(out).toBe('<p>Hello</p><p>Good</p>');
    });
  });

  describe('first-seen wins on duplicate originals', () => {
    it('keeps the first translation when two keys share the same original', () => {
      const html = '<a>Click</a>';
      const out = updatePreviewWithTranslations(
        html,
        { first: 'Click', second: 'Click' },
        { first: 'Cliquez', second: 'Appuyez' }
      );
      expect(out).toBe('<a>Cliquez</a>');
    });
  });

  describe('regex special characters in original text', () => {
    it('treats special chars as literals', () => {
      const html = '<p>Price: $10.00 (USD)</p>';
      const out = updatePreviewWithTranslations(
        html,
        { k: 'Price: $10.00 (USD)' },
        { k: 'Prix : 10,00 $ (USD)' }
      );
      expect(out).toBe('<p>Prix : 10,00 $ (USD)</p>');
    });

    it('handles brackets, braces and backslashes', () => {
      const html = '<p>Array[0] {foo} path\\to\\file</p>';
      const out = updatePreviewWithTranslations(
        html,
        { k: 'Array[0] {foo} path\\to\\file' },
        { k: 'Tableau[0] {foo} chemin\\vers\\fichier' }
      );
      expect(out).toBe('<p>Tableau[0] {foo} chemin\\vers\\fichier</p>');
    });

    it('handles alternation pipes and wildcards', () => {
      const html = '<p>a|b|c and .*? test</p>';
      const out = updatePreviewWithTranslations(
        html,
        { k: 'a|b|c and .*? test' },
        { k: 'x|y|z et .*? essai' }
      );
      expect(out).toBe('<p>x|y|z et .*? essai</p>');
    });
  });

  describe('Pass 2 — HTML-entity-encoded replacement', () => {
    it('replaces text inside an attribute value encoded with &amp;', () => {
      const html = '<img alt="Tea &amp; coffee" src="x.jpg" />';
      const out = updatePreviewWithTranslations(
        html,
        { 'img.alt': 'Tea & coffee' },
        { 'img.alt': 'Thé & café' }
      );
      expect(out).toBe('<img alt="Thé &amp; café" src="x.jpg" />');
    });

    it('replaces text with &lt; and &gt; entities', () => {
      const html = '<img alt="1 &lt; 2 and 3 &gt; 2" />';
      const out = updatePreviewWithTranslations(
        html,
        { k: '1 < 2 and 3 > 2' },
        { k: '1 inférieur 2 et 3 supérieur 2' }
      );
      expect(out).toBe('<img alt="1 inférieur 2 et 3 supérieur 2" />');
    });

    it('handles both direct body text and encoded attribute in the same HTML', () => {
      const html = '<p>Tea & coffee</p><img alt="Tea &amp; coffee" />';
      const out = updatePreviewWithTranslations(
        html,
        { a: 'Tea & coffee' },
        { a: 'Thé & café' }
      );
      // Pass 1 replaces the body; Pass 2 replaces the encoded attribute
      expect(out).toBe('<p>Thé & café</p><img alt="Thé &amp; café" />');
    });
  });

  describe('idempotency and stability', () => {
    it('leaves HTML untouched when no translations match', () => {
      const html = '<p>Untouched body</p>';
      const out = updatePreviewWithTranslations(
        html,
        { k: 'Missing source' },
        { k: 'Missing target' }
      );
      expect(out).toBe(html);
    });

    it('is idempotent on a second run with the same mappings', () => {
      const html = '<p>Hello</p>';
      const once = updatePreviewWithTranslations(
        html,
        { k: 'Hello' },
        { k: 'Bonjour' }
      );
      const twice = updatePreviewWithTranslations(
        once,
        { k: 'Hello' },
        { k: 'Bonjour' }
      );
      expect(twice).toBe(once);
    });
  });
});
