'use strict';

const slugify = require('../../../packages/ui/helpers/slugify').default;

describe('slugify', () => {
  it('returns empty string for nullish input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
  });

  it('lowercases ASCII text', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips diacritics (NFD normalisation)', () => {
    expect(slugify('Évaluation des objets')).toBe('evaluation-des-objets');
    expect(slugify('Naïve façon')).toBe('naive-facon');
    expect(slugify('Über cool')).toBe('uber-cool');
  });

  it('collapses non-alphanumeric runs into a single dash', () => {
    expect(slugify('Hello   World !!! Test')).toBe('hello-world-test');
    expect(slugify('a/b/c')).toBe('a-b-c');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('---hello---')).toBe('hello');
    expect(slugify('!@# clean #@!')).toBe('clean');
  });

  it('truncates to 50 characters max', () => {
    const long = 'A'.repeat(120);
    const out = slugify(long);
    expect(out.length).toBe(50);
    expect(out).toBe('a'.repeat(50));
  });

  it('keeps existing dashes', () => {
    expect(slugify('foo-bar-baz')).toBe('foo-bar-baz');
  });

  it('returns empty string when input has no alphanumerics', () => {
    expect(slugify('!!! @@@ ###')).toBe('');
  });

  it('handles numbers', () => {
    expect(slugify('Version 2.1 beta')).toBe('version-2-1-beta');
  });

  it('coerces non-string input', () => {
    expect(slugify(42)).toBe('42');
  });
});
