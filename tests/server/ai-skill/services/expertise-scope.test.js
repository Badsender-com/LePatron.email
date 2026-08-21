'use strict';

const {
  normalizeScope,
  normalizeScopes,
} = require('../../../../packages/server/ai-skill/services/expertise-scope');

describe('normalizeScope', () => {
  it('trims and lowercases', () => {
    expect(normalizeScope('  CTA ')).toBe('cta');
  });

  it('leaves an already canonical value alone', () => {
    expect(normalizeScope('cta')).toBe('cta');
  });

  it('returns an empty string for anything unusable', () => {
    for (const value of [null, undefined, 42, {}, [], '', '   ']) {
      expect(normalizeScope(value)).toBe('');
    }
  });
});

describe('normalizeScopes', () => {
  // This is the R2 failure: `CTA` typed in the UI never met `cta` hardcoded in
  // a findApplicable call, because the match is a strict string equality.
  it('makes the UI spelling and the code spelling meet', () => {
    expect(normalizeScopes(['CTA'])).toEqual(normalizeScopes(['cta']));
    expect(normalizeScopes([' Objet '])).toEqual(normalizeScopes(['objet']));
  });

  it('accepts a bare string as well as a list', () => {
    expect(normalizeScopes('CTA')).toEqual(['cta']);
  });

  it('dedupes values that collapse once normalised', () => {
    expect(normalizeScopes(['CTA', 'cta', ' cta '])).toEqual(['cta']);
  });

  it('sorts, so two equivalent lists are stored identically', () => {
    expect(normalizeScopes(['objet', 'cta'])).toEqual(
      normalizeScopes(['cta', 'objet'])
    );
  });

  it('drops blanks and non-strings instead of storing them', () => {
    expect(normalizeScopes(['cta', '', null, '  ', 7])).toEqual(['cta']);
  });

  it('returns an empty list for no input', () => {
    expect(normalizeScopes(undefined)).toEqual([]);
    expect(normalizeScopes([])).toEqual([]);
  });

  // Genuine synonyms are out of reach — that is what the findApplicable
  // warning covers.
  it('does not pretend to resolve synonyms', () => {
    expect(normalizeScopes(['bouton'])).not.toEqual(normalizeScopes(['cta']));
  });
});
