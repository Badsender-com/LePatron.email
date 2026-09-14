'use strict';

const {
  parseSections,
} = require('../../../../packages/server/ai-skill/services/expertise-parser.service');

describe('expertise-parser', () => {
  it('returns empty result for empty / non-string input', () => {
    expect(parseSections('')).toEqual({
      sections: [],
      errors: [],
      warnings: [],
    });
    expect(parseSections(null).sections).toEqual([]);
    expect(parseSections(undefined).sections).toEqual([]);
  });

  it('parses well-formed sections with positions', () => {
    const md = [
      '# Intro',
      'Some preamble',
      "## [urgency-strategy] Stratégie d'urgence",
      'Les CTA promo doivent...',
      '## [verbs] Choix des verbes',
      "Privilégier les verbes d'action",
      '## [length] Longueur recommandée',
      'Maximum 25 caractères.',
    ].join('\n');

    const { sections, errors, warnings } = parseSections(md);

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(sections).toEqual([
      { id: 'urgency-strategy', title: "Stratégie d'urgence", position: 0 },
      { id: 'verbs', title: 'Choix des verbes', position: 1 },
      { id: 'length', title: 'Longueur recommandée', position: 2 },
    ]);
  });

  it('rejects section ids that are not valid slugs', () => {
    const md = '## [Bad ID!] Title';
    const { sections, errors } = parseSections(md);

    expect(sections).toEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/Bad ID!/);
  });

  it('rejects duplicate section ids', () => {
    const md = '## [a] First\n## [a] Second';
    const { sections, errors } = parseSections(md);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('First');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Duplicate/);
  });

  it('warns on H2 without bracket prefix but does not error', () => {
    const md = '## A plain heading\n## [ok] Good one';
    const { sections, errors, warnings } = parseSections(md);

    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/A plain heading/);
    expect(sections).toEqual([{ id: 'ok', title: 'Good one', position: 0 }]);
  });

  it('ignores H1 and H3+', () => {
    const md = '# [h1] X\n### [h3] Y\n## [h2] Z';
    const { sections } = parseSections(md);
    expect(sections).toEqual([{ id: 'h2', title: 'Z', position: 0 }]);
  });
});
