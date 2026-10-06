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
} = require('../../../packages/server/translation/synthetic-block-protection.js');
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

// The translated copy's previewHtml is sanitized before storage. Sanitizing the
// pasted markup with it stripped the ESP scripts the block exists for, so the
// copy's ZIP no longer matched its export.
describe('transformDocumentKeepingHtmlCodeBlocks, the pasted markup', () => {
  const pasted = '<script>espTracking("$&")</script><p>kept</p>';
  const html = [
    '<html><head></head><body>',
    '<p>translated<img src="x" onerror="alert(1)"></p>',
    `<div class="lp-html-block-root"><div class="lp-html-block">${pasted}</div></div>`,
    '</body></html>',
  ].join('');

  it('sanitizes the document but puts the pasted markup back byte for byte', () => {
    const result = transformDocumentKeepingHtmlCodeBlocks(
      html,
      sanitizePreviewHtml,
      [pasted]
    );
    expect(result).not.toMatch(/onerror/);
    expect(result).toContain(`<div class="lp-html-block">${pasted}</div>`);
  });

  it('is the plain transform without any block', () => {
    const shout = (s) => s.toUpperCase();
    expect(transformDocumentKeepingHtmlCodeBlocks('<p>a</p>', shout)).toBe(
      '<P>A</P>'
    );
  });
});

// The marker element around the markup is LePatron's own: nothing in it needs
// protecting, and a previewHtml written by hand could hang anything on it.
describe('transformDocumentKeepingHtmlCodeBlocks, the marker element', () => {
  const crafted = (inner) =>
    `<div class="lp-html-block" onmouseover="alert(1)">${inner}</div>`;

  it('goes through the transform with the rest of the document', () => {
    const result = transformDocumentKeepingHtmlCodeBlocks(
      doc(crafted(stored)),
      sanitizePreviewHtml,
      [stored]
    );

    expect(result).not.toMatch(/onmouseover/);
    expect(result).toContain(`<div class="lp-html-block">${stored}</div>`);
  });

  it('is transformed around a markup put back byte for byte', () => {
    const inner = '<div>kept</div>';
    const tag = (part) => part.replace(/<div/g, '<div data-t');

    const result = transformDocumentKeepingHtmlCodeBlocks(
      `<div class="lp-html-block">${inner}</div>`,
      tag,
      [inner]
    );

    expect(result).toBe(`<div data-t class="lp-html-block">${inner}</div>`);
  });
});
