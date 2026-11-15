'use strict';

// The name proposed for a new dimension from its label (#1551): what a
// template will read, so a valid property name, written once (ADR-0015).

const { proposeDimensionName } = require('~/helpers/taxonomy-builder.js');

describe('the name proposed for a new dimension', () => {
  it.each([
    ['Marché', 'marche'],
    ['Marque éditoriale', 'marqueEditoriale'],
    ['Cible B2B', 'cibleB2b'],
    ["Langue de l'email", 'langueDeLEmail'],
    ['  Saison  ', 'saison'],
    ['2024 Season', '_2024Season'],
    ['!!!', ''],
  ])('proposes %j as %j', (label, expected) => {
    expect(proposeDimensionName(label)).toBe(expected);
  });
});
