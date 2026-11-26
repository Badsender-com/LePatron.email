'use strict';

// The one drop-position convention, shared by the elements of a column and
// the rows of a block: a position counts the items with the moved one still in
// place.

const {
  moveInList,
} = require('../../../packages/shared/block-builder/move-in-list.js');

const letters = () => ['a', 'b', 'c', 'd'];

describe('moveInList', () => {
  it('moves an item up to a position above it', () => {
    const list = letters();

    expect(moveInList(list, 2, 0)).toBe(true);
    expect(list).toEqual(['c', 'a', 'b', 'd']);
  });

  // Position 3 is the line between `c` and `d`: past `b`'s old place, so it
  // comes down by one once `b` is out.
  it('moves an item down to a position below it', () => {
    const list = letters();

    expect(moveInList(list, 1, 3)).toBe(true);
    expect(list).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves one place down when dropped past the next item', () => {
    const list = letters();

    expect(moveInList(list, 0, 2)).toBe(true);
    expect(list).toEqual(['b', 'a', 'c', 'd']);
  });

  it('moves to the end when dropped below the last item', () => {
    const list = letters();

    expect(moveInList(list, 0, 4)).toBe(true);
    expect(list).toEqual(['b', 'c', 'd', 'a']);
  });

  // Just above itself and just below itself are the same place.
  it.each([1, 2])('leaves the item where it is at position %i', (position) => {
    const list = letters();

    expect(moveInList(list, 1, position)).toBe(false);
    expect(list).toEqual(letters());
  });

  it('brings a position outside the list back to its nearest end', () => {
    const below = letters();
    const above = letters();

    expect(moveInList(below, 0, 99)).toBe(true);
    expect(below).toEqual(['b', 'c', 'd', 'a']);
    expect(moveInList(above, 3, -5)).toBe(true);
    expect(above).toEqual(['d', 'a', 'b', 'c']);
  });

  it.each([
    ['an item that is not there', letters(), 7, 0],
    ['a negative index', letters(), -1, 0],
    ['a position that is not a number', letters(), 0, 'end'],
    ['something that is not a list', null, 0, 1],
  ])('changes nothing for %s', (_, list, from, position) => {
    expect(moveInList(list, from, position)).toBe(false);
    if (list) expect(list).toEqual(letters());
  });
});
