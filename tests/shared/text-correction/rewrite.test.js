'use strict';

/**
 * A rewrite (ADR 0011): a correction changing more than three words, compared
 * one by one, punctuation and spaces aside.
 */

const {
  isRewrite,
} = require('../../../packages/shared/text-correction/rewrite');

describe('spelling correction: a rewrite', () => {
  it.each([
    ['a word', 'Les soldes commence', 'Les soldes commencent'],
    ['the punctuation and the spaces', 'Bonjour , merci', 'Bonjour ! Merci.'],
    ['an apostrophe', "L'été arrive", 'L’été arrive'],
    ['three words', 'les chien son mechant', 'les chiens sont méchants'],
    ['three words removed', 'Les soldes commencent demain matin', 'Les soldes'],
    ['three words added', 'Les soldes', 'Les soldes commencent demain matin'],
    ['a removal of three words', 'trois mots en trop', 'trop'],
  ])('is not one when it changes %s', (_label, before, after) => {
    expect(isRewrite(before, after)).toBe(false);
  });

  it.each([
    [
      'four words',
      'les chien son mechant gro',
      'les chiens sont méchants gros',
    ],
    [
      'four words removed',
      'Les soldes commencent demain matin tôt',
      'Les soldes',
    ],
    ['a removal of four words', 'quatre mots en trop', ''],
    [
      'the whole sentence',
      'Profitez vite de nos offres',
      'Découvrez dès maintenant toutes nos promotions',
    ],
  ])('is one when it changes %s', (_label, before, after) => {
    expect(isRewrite(before, after)).toBe(true);
  });
});
