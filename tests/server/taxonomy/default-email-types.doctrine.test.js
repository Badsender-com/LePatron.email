'use strict';

// Restoring the default email types (epic #1631, ADR-0030): what a company
// lacks is judged on the doctrine type, whatever it called or identified the
// email types it has. A restored email type takes its doctrine type as
// identifier, suffixed when the company already uses that identifier.

const {
  buildDefaultEmailTypes,
  planMissingDefaultEmailTypes,
} = require('../../../packages/server/taxonomy/services/default-email-types.js');

const existing = (label, canonicalType, doctrineType) => ({
  label,
  canonicalType,
  doctrineType,
});

// Turned on by #1635 (default email types are judged on the doctrine type)
describe('default email types judged on the doctrine type', () => {
  it('seeds each default email type with its doctrine type, also its identifier', () => {
    const editorial = buildDefaultEmailTypes('fr').find(
      (item) => item.doctrineType === 'editorial'
    );

    expect(editorial).toMatchObject({
      label: 'Éditorial',
      canonicalType: 'editorial',
      doctrineType: 'editorial',
    });
  });

  it('does not restore a doctrine type the company declined under its own identifiers', () => {
    const { toCreate } = planMissingDefaultEmailTypes(
      [
        existing('Infolettre communauté', 'com', 'editorial'),
        existing('Relationnel', 'rel', 'editorial'),
      ],
      'fr'
    );

    expect(toCreate.map((item) => item.doctrineType)).not.toContain(
      'editorial'
    );
    expect(toCreate).toHaveLength(5);
  });

  it('restores a doctrine type the company has only as an identifier', () => {
    // An email type identified `promotional` but mapped onto nothing is not the
    // promotional type of the doctrine.
    const { toCreate } = planMissingDefaultEmailTypes(
      [existing('Promo maison', 'promotional', null)],
      'fr'
    );

    const restored = toCreate.find(
      (item) => item.doctrineType === 'promotional'
    );
    expect(restored).toMatchObject({
      label: 'Promotionnel',
      canonicalType: 'promotional_2',
    });
  });

  it('gives every restored email type an identifier the company does not use yet', () => {
    const { toCreate } = planMissingDefaultEmailTypes(
      [
        existing('Service client', 'service', 'notification'),
        existing('Service client 2', 'service_2', null),
      ],
      'fr'
    );

    expect(
      toCreate.find((item) => item.doctrineType === 'service').canonicalType
    ).toBe('service_3');
  });
});
