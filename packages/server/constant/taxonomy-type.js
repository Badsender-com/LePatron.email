'use strict';

const {
  STANDARD_DIMENSIONS,
  STANDARD_DIMENSION_NAMES,
  DIMENSION_NAME_PATTERN,
  RESERVED_DIMENSION_NAMES,
  TAXONOMY_LIMITS,
} = require('../../shared/taxonomy/constants.js');

/**
 * The two standard dimensions (ADR-0032): the doctrine defines them, so every
 * company has them and none can deactivate or delete them. Every other dimension
 * (market, language, brand, audience…) is declared by the company itself, and
 * the product knows nothing of it but its name.
 *
 * Only the email type takes values in the taxonomy. The trigger's two values
 * are the doctrine's (constant/email-trigger.js) and a company cannot add a
 * third, so no taxonomy item is ever stored under it.
 *
 * Defined in packages/shared/taxonomy/constants.js, which the taxonomy screen
 * reads too; named here as the server code has always named them.
 */
const StandardDimensions = STANDARD_DIMENSIONS;

const StandardDimensionNames = STANDARD_DIMENSION_NAMES;

// Kept for the code that only knows the email type: the restore defaults action,
// the email type select of the metadata.
const TaxonomyTypes = Object.freeze({
  EMAIL_TYPE: StandardDimensions.EMAIL_TYPE,
});

/**
 * Bounds of the editable fields, read by the Mongoose schemas, the service
 * validation and the forms alike.
 */
const TaxonomyLimits = TAXONOMY_LIMITS;

module.exports = {
  StandardDimensions,
  StandardDimensionNames,
  TaxonomyTypes,
  DIMENSION_NAME_PATTERN,
  RESERVED_DIMENSION_NAMES,
  TaxonomyLimits,
};
