'use strict';

// The points to check of a company's taxonomy (epic #1547, ADR-0026): what it
// lacks that the application can tell, shown without ever blocking.

const {
  DIMENSIONS,
  VALUES,
  TEMPLATES,
} = require('./taxonomy-workspace.fixtures.js');

describe('points to check', () => {
  let pointsToCheck;
  let pointsByDimension;

  beforeAll(() => {
    ({
      pointsToCheck,
      pointsByDimension,
    } = require('~/helpers/taxonomy-checks.js'));
  });

  const check = ({
    dimensions = DIMENSIONS,
    values = VALUES,
    templates = TEMPLATES,
  } = {}) => pointsToCheck({ dimensions, values, templates });

  const EXPECTED = [
    { kind: 'missingCode', dimension: 'language', valueId: 'lg-it' },
    { kind: 'nothingOffered', dimension: 'language', parentValueId: 'mk-de' },
    { kind: 'nothingOffered', dimension: 'range', parentValueId: 'br-nova' },
    { kind: 'noValue', dimension: 'audience' },
    { kind: 'tokenUnread', dimension: 'brand', token: 'ctaColorVar' },
    { kind: 'tokenUnread', dimension: 'range', token: 'accentColorVar' },
    {
      kind: 'literalNotCarried',
      dimension: 'market',
      identifier: 'uk',
      templateIds: ['tpl-newsletter'],
    },
  ];

  it('finds every point of the worked example, and nothing else', () => {
    const points = check();

    expect(points).toEqual(expect.arrayContaining(EXPECTED));
    expect(points).toHaveLength(EXPECTED.length);
  });

  it('counts them per dimension, for the tree', () => {
    expect(pointsByDimension(check())).toEqual({
      language: 2,
      range: 2,
      audience: 1,
      brand: 1,
      market: 1,
    });
  });

  it('finds a dimension only the templates reading it offer, which no template reads', () => {
    const season = {
      ...DIMENSIONS.find((d) => d.name === 'brand'),
      id: 'dim-season',
      name: 'season',
      label: 'Saison',
    };
    const winter = {
      ...VALUES.find((v) => v.id === 'br-nova'),
      id: 'ss-winter',
      type: 'season',
      label: 'Hiver',
      tokens: {},
    };

    expect(
      check({
        dimensions: [...DIMENSIONS, season],
        values: [...VALUES, winter],
      })
    ).toContainEqual({ kind: 'dimensionUnread', dimension: 'season' });
  });

  it('asks nothing of a deactivated value', () => {
    const values = VALUES.map((v) =>
      v.id === 'lg-it' ? { ...v, isActive: false } : v
    );

    expect(check({ values })).not.toContainEqual(
      expect.objectContaining({ kind: 'missingCode' })
    );
  });

  it('takes a literal carried by a deactivated value as carried', () => {
    const values = [
      ...VALUES,
      {
        ...VALUES.find((v) => v.id === 'mk-fr'),
        id: 'mk-uk',
        label: 'Royaume-Uni',
        canonicalType: 'uk',
        isActive: false,
      },
    ];

    expect(check({ values })).not.toContainEqual(
      expect.objectContaining({ kind: 'literalNotCarried' })
    );
  });

  it('asks nothing of a deactivated dimension', () => {
    const dimensions = DIMENSIONS.map((d) =>
      d.name === 'audience' ? { ...d, isActive: false } : d
    );

    expect(check({ dimensions })).not.toContainEqual({
      kind: 'noValue',
      dimension: 'audience',
    });
  });

  it('never asks the trigger for values: they are the doctrine', () => {
    expect(check()).not.toContainEqual(
      expect.objectContaining({ dimension: 'trigger' })
    );
  });

  it('finds nothing to check in a complete taxonomy', () => {
    const complete = check({
      dimensions: DIMENSIONS.filter((d) =>
        ['emailType', 'trigger', 'market'].includes(d.name)
      ),
      values: VALUES.filter((v) => ['emailType', 'market'].includes(v.type)),
      templates: [
        {
          id: 'tpl-x',
          name: 'X',
          contract: {
            declared: {},
            read: ['market'],
            adopt: {},
            compared: [{ property: 'market', literal: 'be', count: 1 }],
          },
        },
      ],
    });

    expect(complete).toEqual([]);
  });
});
