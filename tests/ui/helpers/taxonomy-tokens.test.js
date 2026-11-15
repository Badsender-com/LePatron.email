'use strict';

// The design tokens of the taxonomy (#1558): which dimensions carry some, the
// winner last, and what each dimension's values carry.

const { DIMENSIONS, VALUES } = require('./taxonomy-workspace.fixtures.js');
const {
  precedenceList,
  precedenceExamples,
  tokensOfDimension,
} = require('~/helpers/taxonomy-tokens.js');

describe('token precedence as a list', () => {
  it('lists the dimensions carrying tokens, the highest precedence last', () => {
    expect(precedenceList({ dimensions: DIMENSIONS, values: VALUES })).toEqual([
      {
        name: 'brand',
        label: 'Marque',
        tokens: ['ctaColorVar', 'logoUrl', 'mainColorVar'],
      },
      { name: 'range', label: 'Gamme', tokens: ['accentColorVar'] },
    ]);
  });

  it('leaves out a dimension whose only tokens sit on deactivated values', () => {
    const values = VALUES.map((v) =>
      v.id === 'rg-junior' ? { ...v, isActive: false } : v
    );

    expect(
      precedenceList({ dimensions: DIMENSIONS, values }).map((d) => d.name)
    ).toEqual(['brand']);
  });
});

describe('the tokens of a dimension', () => {
  it('gives each token and the values carrying it', () => {
    expect(tokensOfDimension('brand', VALUES)).toEqual([
      {
        token: 'ctaColorVar',
        carriedBy: [{ label: 'Atlas', value: '#ff0000' }],
      },
      {
        token: 'logoUrl',
        carriedBy: [
          { label: 'Atlas', value: 'atlas.png' },
          { label: 'Nova', value: 'nova.png' },
        ],
      },
      {
        token: 'mainColorVar',
        carriedBy: [
          { label: 'Atlas', value: '#265090' },
          { label: 'Nova', value: '#ffb400' },
        ],
      },
    ]);
  });

  it('gives nothing for a dimension carrying no token', () => {
    expect(tokensOfDimension('market', VALUES)).toEqual([]);
  });
});

// Acceptance test of #1547 (US 24): the order explained on the company's own
// values.
describe('what the precedence decides', () => {
  const withJuniorColour = VALUES.map((v) =>
    v.id === 'rg-junior'
      ? { ...v, tokens: { accentColorVar: '#00acdc', mainColorVar: '#7fbf3f' } }
      : v
  );
  const examples = (values) =>
    precedenceExamples(
      precedenceList({ dimensions: DIMENSIONS, values }),
      values
    );

  it('shows, for a token two dimensions carry, the value that wins and the one it wins over', () => {
    expect(examples(withJuniorColour)).toEqual([
      {
        token: 'mainColorVar',
        winner: { dimension: 'Gamme', label: 'Junior', value: '#7fbf3f' },
        loser: { dimension: 'Marque', label: 'Atlas', value: '#265090' },
      },
    ]);
  });

  it('shows nothing while no token is carried by two dimensions', () => {
    expect(examples(VALUES)).toEqual([]);
  });
});
