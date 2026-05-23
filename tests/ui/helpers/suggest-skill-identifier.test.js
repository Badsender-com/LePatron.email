'use strict';

const suggest = require('../../../packages/ui/helpers/suggest-skill-identifier')
  .default;

describe('suggestIdentifier', () => {
  it('builds <category>.<title> for a skill', () => {
    expect(suggest({ category: 'qc', title: 'Évaluation des objets' })).toBe(
      'qc.evaluation-des-objets'
    );
  });

  it('builds <category>.<scope>.<title> for an expertise', () => {
    expect(
      suggest({
        category: 'redaction',
        scope: ['cta'],
        title: 'Principes généraux des CTAs',
      })
    ).toBe('redaction.cta.principes-generaux-des-ctas');
  });

  it('uses only the first scope value when multiple are provided', () => {
    expect(
      suggest({
        category: 'redaction',
        scope: ['cta', 'subject', 'preheader'],
        title: 'Promo',
      })
    ).toBe('redaction.cta.promo');
  });

  it('skips the scope segment when scope is empty', () => {
    expect(suggest({ category: 'redaction', scope: [], title: 'Promo' })).toBe(
      'redaction.promo'
    );
  });

  it('returns empty when title is missing', () => {
    expect(suggest({ category: 'redaction' })).toBe('redaction');
  });

  it('returns empty when nothing is provided', () => {
    expect(suggest({})).toBe('');
    expect(suggest()).toBe('');
  });

  it('accepts a scalar scope (not just an array)', () => {
    expect(suggest({ category: 'redaction', scope: 'cta', title: 'X' })).toBe(
      'redaction.cta.x'
    );
  });

  it('drops null/empty scope entries', () => {
    expect(
      suggest({
        category: 'redaction',
        scope: ['', null, 'cta'],
        title: 'X',
      })
    ).toBe('redaction.cta.x');
  });

  it('truncates each segment via slugify (50 char cap per segment)', () => {
    const longTitle = 'A'.repeat(120);
    const out = suggest({ category: 'redaction', title: longTitle });
    // 'redaction'.length === 9, plus '.', plus 50 'a' = 60
    expect(out).toBe('redaction.' + 'a'.repeat(50));
  });
});
