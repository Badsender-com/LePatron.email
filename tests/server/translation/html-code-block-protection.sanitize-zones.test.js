'use strict';

// The sanitizer leaves out only the zones it can tie to a stored block: those
// whose content is, byte for byte, the markup stored on the mailing. A marker
// class on its own proves nothing — any text written into the preview can
// carry one — so a zone located only by counting `<div>` is sanitized with the
// rest of the document. The string replacement is not concerned: it keeps
// protecting both kinds, where leaving text untranslated is the safe side.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  transformDocumentKeepingHtmlCodeBlocks,
  transformOutsideHtmlCodeBlocks,
} = require('../../../packages/server/translation/html-code-block-protection.js');
const {
  sanitizePreviewHtml,
} = require('../../../packages/server/utils/preview-html-sanitizer.js');

const zone = (inner) =>
  `<div class="lp-html-block-root"><div class="lp-html-block">${inner}</div></div>`;
const doc = (...parts) =>
  ['<html><head></head><body>', ...parts, '</body></html>'].join('');

const stored = '<script>espTracking()</script><p>stored</p>';
const unknown = '<p>written<img src="x" onerror="alert(1)"></p>';

describe('transformDocumentKeepingHtmlCodeBlocks', () => {
  it('keeps a zone matched on its stored markup', () => {
    const result = transformDocumentKeepingHtmlCodeBlocks(
      doc(zone(stored)),
      sanitizePreviewHtml,
      [stored]
    );

    expect(result).toContain(zone(stored));
  });

  it('sanitizes a zone that matches no stored markup', () => {
    const result = transformDocumentKeepingHtmlCodeBlocks(
      doc(zone(stored), zone(unknown)),
      sanitizePreviewHtml,
      [stored]
    );

    expect(result).toContain(zone(stored));
    expect(result).not.toMatch(/onerror/);
  });

  it('sanitizes every zone when no stored markup is given', () => {
    const result = transformDocumentKeepingHtmlCodeBlocks(
      doc(zone(unknown)),
      sanitizePreviewHtml
    );

    expect(result).not.toMatch(/onerror/);
  });
});

describe('transformOutsideHtmlCodeBlocks', () => {
  it('still keeps an unmatched zone out of the string replacement', () => {
    const upper = (part) => part.toUpperCase();

    const result = transformOutsideHtmlCodeBlocks(
      doc('<p>text</p>', zone('<p>pasted</p>')),
      upper,
      []
    );

    expect(result).toContain('<P>TEXT</P>');
    expect(result).toContain('<p>pasted</p>');
  });
});
