'use strict';

/**
 * The two standard dimensions (ADR-0014): the doctrine defines them, so every
 * company has them and none can deactivate or delete them. Every other dimension
 * (market, language, brand, audience…) is declared by the company itself, and
 * the product knows nothing of it but its name.
 *
 * Only the email type takes values in the taxonomy. The trigger's two values
 * are the doctrine's (constant/email-trigger.js) and a company cannot add a
 * third, so no taxonomy item is ever stored under it.
 */
const StandardDimensions = Object.freeze({
  EMAIL_TYPE: 'emailType',
  TRIGGER: 'trigger',
});

const StandardDimensionNames = Object.freeze(Object.values(StandardDimensions));

// Kept for the code that only knows the email type: the restore defaults action,
// the email type select of the metadata.
const TaxonomyTypes = Object.freeze({
  EMAIL_TYPE: StandardDimensions.EMAIL_TYPE,
});

/**
 * A dimension's name is what a template reads (ADR-0015), so it accepts exactly
 * what a template property name accepts, and nothing more. Capitals are allowed:
 * `emailType` is one of the two standard dimensions.
 */
const DIMENSION_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  // Same reasoning for the dimensions: a company declines its emails by a
  // handful of axes, not a hundred.
  DIMENSIONS_PER_COMPANY: 20,
});

module.exports = {
  StandardDimensions,
  StandardDimensionNames,
  TaxonomyTypes,
  DIMENSION_NAME_PATTERN,
  TaxonomyLimits,
};
