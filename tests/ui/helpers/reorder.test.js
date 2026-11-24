'use strict';

// The order shown before the server answers (review of #1547): a second
// Alt + arrow on a value starts from the first move, not from the list read
// before it.

const { moveItem, orderedBy } = require('~/helpers/reorder.js');

const items = [
  { id: 'fr', label: 'France' },
  { id: 'be', label: 'Belgique' },
  { id: 'ca', label: 'Canada' },
];
const labels = (list) => list.map((item) => item.label);

describe('the order shown after a move', () => {
  it('puts the items in the order of their ids', () => {
    expect(labels(orderedBy(items, ['ca', 'fr', 'be']))).toEqual([
      'Canada',
      'France',
      'Belgique',
    ]);
  });

  it('lets two moves in a row add up', () => {
    const ids = items.map((item) => item.id);
    const first = moveItem(ids, 0, 1);
    const shown = orderedBy(items, first);
    const second = moveItem(
      shown.map((item) => item.id),
      1,
      2
    );

    expect(labels(orderedBy(shown, second))).toEqual([
      'Belgique',
      'Canada',
      'France',
    ]);
  });

  it('keeps an item missing from the ids at the end, and skips an unknown id', () => {
    expect(labels(orderedBy(items, ['be', 'xx', 'fr']))).toEqual([
      'Belgique',
      'France',
      'Canada',
    ]);
  });

  it('changes neither list given', () => {
    const ids = ['ca', 'be', 'fr'];
    orderedBy(items, ids);

    expect(labels(items)).toEqual(['France', 'Belgique', 'Canada']);
    expect(ids).toEqual(['ca', 'be', 'fr']);
  });
});
