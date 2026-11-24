'use strict';

// Finding an element or a row in a composition: across every row and every
// column, on the composition's own objects, and without trusting the shape.

const {
  locateElement,
  rowById,
  elementsOfState,
} = require('../../../packages/shared/block-builder/composition.js');

const composition = () => ({
  rows: [
    {
      id: 'row-a-1',
      columns: [{ width: 100, elements: [{ id: 'e1', type: 'text' }] }],
    },
    {
      id: 'row-b-2',
      columns: [
        { width: 50, elements: [] },
        {
          width: 50,
          elements: [
            { id: 'e2', type: 'button' },
            { id: 'e3', type: 'divider' },
          ],
        },
      ],
    },
  ],
});

describe('locateElement', () => {
  it('finds an element in any row and any column', () => {
    const state = composition();

    const place = locateElement(state, 'e3');

    expect(place.row).toBe(state.rows[1]);
    expect(place.column).toBe(state.rows[1].columns[1]);
    expect(place.index).toBe(1);
  });

  // The live objects: a splice through the place moves the element.
  it('hands back the composition’s own column', () => {
    const state = composition();

    const { column, index } = locateElement(state, 'e2');
    column.elements.splice(index, 1);

    expect(elementsOfState(state).map((element) => element.id)).toEqual([
      'e1',
      'e3',
    ]);
  });

  it('agrees with elementsOfState on what the composition holds', () => {
    const state = composition();

    elementsOfState(state).forEach((element) =>
      expect(locateElement(state, element.id)).not.toBeNull()
    );
  });

  it.each([[null], [''], [42], ['absent']])('finds nothing for %p', (id) => {
    expect(locateElement(composition(), id)).toBeNull();
  });

  it('reads a malformed composition as holding nothing', () => {
    expect(locateElement(null, 'e1')).toBeNull();
    expect(locateElement({ rows: [null, { columns: 'x' }] }, 'e1')).toBeNull();
    expect(
      locateElement({ rows: [{ columns: [{ elements: [null] }] }] }, 'e1')
    ).toBeNull();
  });
});

describe('rowById', () => {
  it('finds a row by its id', () => {
    const state = composition();

    expect(rowById(state, 'row-b-2')).toBe(state.rows[1]);
  });

  it.each([[null], [''], ['row-z-9']])('finds nothing for %p', (id) => {
    expect(rowById(composition(), id)).toBeNull();
    expect(rowById({ rows: 'x' }, id)).toBeNull();
  });
});
