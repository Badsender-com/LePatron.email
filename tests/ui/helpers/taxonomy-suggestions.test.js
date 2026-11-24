'use strict';

// The dimensions suggested to a company with none of its own (#1559).

const {
  suggestedDimensions,
  hasNoCompanyDimension,
} = require('~/helpers/taxonomy-suggestions.js');

const STANDARD = [
  { name: 'emailType', standard: true },
  { name: 'trigger', standard: true },
];

describe('the dimensions suggested to a company', () => {
  it('suggests market, language, brand and audience to a company with only the standard ones', () => {
    expect(suggestedDimensions(STANDARD)).toEqual([
      {
        name: 'market',
        labelKey: 'taxonomy.workspace.start.suggestions.market',
        role: 'country',
        parentName: null,
      },
      {
        name: 'language',
        labelKey: 'taxonomy.workspace.start.suggestions.language',
        role: 'language',
        parentName: null,
      },
      {
        name: 'brand',
        labelKey: 'taxonomy.workspace.start.suggestions.brand',
        role: null,
        parentName: null,
      },
      {
        name: 'audience',
        labelKey: 'taxonomy.workspace.start.suggestions.audience',
        role: null,
        parentName: null,
      },
    ]);
  });

  it('puts the language under the market once the market exists', () => {
    const suggestions = suggestedDimensions([
      ...STANDARD,
      { name: 'market', role: 'country' },
    ]);

    expect(suggestions.map((s) => s.name)).toEqual([
      'language',
      'brand',
      'audience',
    ]);
    expect(suggestions[0].parentName).toBe('market');
  });

  it('never offers a name already taken, nor a role another dimension holds', () => {
    const suggestions = suggestedDimensions([
      ...STANDARD,
      { name: 'brand' },
      { name: 'country', role: 'country' },
    ]);

    expect(suggestions.map((s) => s.name)).toEqual([
      'market',
      'language',
      'audience',
    ]);
    expect(suggestions[0].role).toBeNull();
  });

  it('tells a company with only the standard dimensions apart', () => {
    expect(hasNoCompanyDimension(STANDARD)).toBe(true);
    expect(hasNoCompanyDimension([...STANDARD, { name: 'brand' }])).toBe(false);
  });
});
