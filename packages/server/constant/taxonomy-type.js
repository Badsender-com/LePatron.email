'use strict';

/**
 * Types of taxonomy item a company can define.
 *
 * Phase 1 ships `emailType` only. Language and brand were deliberately left out:
 * they are axes of *template variation* (brand, language, country, ESP, audience)
 * rather than metadata of a single email, and belong to the CRM Governance
 * module. Adding a type here later costs nothing — that is why the taxonomy is
 * one entity with a `type` discriminator rather than one collection per axis.
 */
const TaxonomyTypes = Object.freeze({
  EMAIL_TYPE: 'emailType',
});

const TaxonomyTypeValues = Object.freeze(Object.values(TaxonomyTypes));

/**
 * Bounds of the editable fields. Declared here so the Mongoose schema, the service
 * validation and the form all read the same numbers — they were written three
 * times, and three copies of a limit is two chances to disagree.
 */
const TaxonomyLimits = Object.freeze({
  LABEL: 120,
  DESCRIPTION: 2000,
  CANONICAL_TYPE: 60,
  // A company describing its own editorial vocabulary needs tens of entries, not
  // thousands. Bounds both the unpaginated read and the storage.
  ITEMS_PER_COMPANY: 200,
});

module.exports = { TaxonomyTypes, TaxonomyTypeValues, TaxonomyLimits };
