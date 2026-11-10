'use strict';

const {
  containing,
  containingRegExp,
} = require('../../../packages/server/utils/text-search.js');

describe('text search', () => {
  it.each([
    ['evenement', 'Événement de rentrée', true],
    ['Événement', 'EVENEMENT', true],
    ['garcon', 'Garçon', true],
    ['noel', 'Noël', true],
    ['50%', 'Up to 50% off', true],
    ['(c++)', 'Learn (c++) today', true],
    ['.*', 'anything', false],
    ['soldes', 'Sales', false],
  ])('finds "%s" in "%s": %s', (text, name, found) => {
    expect(containingRegExp(text).test(name)).toBe(found);
  });

  it('gives MongoDB the same pattern, case-insensitive', () => {
    const condition = containing('noel');

    expect(condition.$options).toBe('i');
    expect(new RegExp(condition.$regex, 'i').test('Noël')).toBe(true);
  });
});
