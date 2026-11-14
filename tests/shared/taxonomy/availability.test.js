'use strict';

// The parent a dimension has on an email, and what a value is offered under
// (ADR-0014, ADR-0024): one rule for the server, the editor and adoption.

const {
  isOfferedUnder,
  effectiveParentName,
  inTreeOrder,
} = require('../../../packages/shared/taxonomy/availability.js');

describe('what a value is offered under', () => {
  it('is every parent value when its availability lists none', () => {
    expect(isOfferedUnder({ parentIds: [] }, 'be')).toBe(true);
  });

  it('is the parent values its availability lists', () => {
    expect(isOfferedUnder({ parentIds: ['be'] }, 'be')).toBe(true);
    expect(isOfferedUnder({ parentIds: ['be'] }, 'ca')).toBe(false);
  });
});

describe('the parent a dimension has on an email', () => {
  const offered = new Set(['market', 'language']);

  it('is its parent when the parent is offered on the email', () => {
    expect(
      effectiveParentName({ name: 'language', parentName: 'market' }, offered)
    ).toBe('market');
  });

  it('is none when the parent is out of scope or deactivated', () => {
    expect(
      effectiveParentName({ name: 'siloBrand', parentName: 'silo' }, offered)
    ).toBeNull();
  });

  it('is the email type, which has its own field', () => {
    expect(
      effectiveParentName({ name: 'tone', parentName: 'emailType' }, offered)
    ).toBe('emailType');
  });
});

describe('the order dimensions are looked at in', () => {
  it('puts each parent before its children, whatever the order given', () => {
    const order = inTreeOrder([
      { name: 'language', parentName: 'market' },
      { name: 'tone', parentName: 'emailType' },
      { name: 'market' },
    ]).map((dimension) => dimension.name);

    expect(order).toEqual(['market', 'language', 'tone']);
  });
});
