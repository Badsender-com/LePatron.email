'use strict';

// The order dimensions are listed in is shared by the server's listing, the
// taxonomy screen and the editor (ADR-0032): one comparator, so the three never
// disagree.

const {
  compareDimensions,
} = require('../../../packages/shared/taxonomy/sort.js');

const names = (dimensions) =>
  [...dimensions].sort(compareDimensions).map((dimension) => dimension.name);

describe('the order of the dimensions', () => {
  it('lists them by their order', () => {
    expect(
      names([
        { name: 'market', order: 21 },
        { name: 'emailType', order: 10 },
        { name: 'trigger', order: 20 },
      ])
    ).toEqual(['emailType', 'trigger', 'market']);
  });

  it('puts the first declared first when two share an order', () => {
    expect(
      names([
        { name: 'audience', order: 0, createdAt: '2026-11-02T10:00:00.000Z' },
        { name: 'brand', order: 0, createdAt: new Date('2026-11-01') },
      ])
    ).toEqual(['brand', 'audience']);
  });

  it('ignores the label: the admin may rename it, the place stays', () => {
    expect(
      names([
        { name: 'b', label: 'A', order: 1, createdAt: '2026-11-02' },
        { name: 'a', label: 'Z', order: 1, createdAt: '2026-11-01' },
      ])
    ).toEqual(['a', 'b']);
  });

  it('reads a missing order as 0, and a missing date as the latest', () => {
    expect(
      names([
        { name: 'undated', order: 0 },
        { name: 'unordered', createdAt: '2026-11-01' },
        { name: 'first', order: -1 },
      ])
    ).toEqual(['first', 'unordered', 'undated']);
  });

  it('breaks a full tie by name, whatever the input order', () => {
    const seeded = [
      { name: 'trigger', order: 0, createdAt: '2026-11-01' },
      { name: 'emailType', order: 0, createdAt: '2026-11-01' },
    ];

    expect(names(seeded)).toEqual(['emailType', 'trigger']);
    expect(names([...seeded].reverse())).toEqual(['emailType', 'trigger']);
  });
});
