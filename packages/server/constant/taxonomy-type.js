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

module.exports = { TaxonomyTypes, TaxonomyTypeValues };
