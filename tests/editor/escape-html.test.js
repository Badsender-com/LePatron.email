'use strict';

// The export menu's buttons show labels a company admin types (the CDN and
// FTP labels, the ESP profiles' names). jQuery UI's button writes its label
// as HTML: they must reach it escaped.

const {
  escapeHtml,
} = require('../../packages/editor/src/js/utils/escape-html.js');

describe('escaping a label for the export menu', () => {
  it('escapes markup', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)> & "co"')).toBe(
      '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;'
    );
  });

  it('escapes quotes', () => {
    expect(escapeHtml("L'Oréal")).toBe('L&#39;Oréal');
  });

  it('keeps a plain label as it is', () => {
    expect(escapeHtml('HTML avec images hébergées')).toBe(
      'HTML avec images hébergées'
    );
  });

  it('gives an empty label for none', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
  });
});
