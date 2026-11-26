'use strict';

const { Conflict } = require('http-errors');

const {
  TaxonomyItems,
  TaxonomyDimensions,
} = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  StandardDimensions,
  StandardDimensionNames,
} = require('../../constant/taxonomy-type.js');

/**
 * What a value must not share with another value of its dimension, in its
 * company: its label, and its identifier; and the names its design tokens must
 * not take from the company's dimensions. Checked before each write by
 * taxonomy.service.js, which owns the values.
 */
module.exports = {
  assertLabelIsFree,
  assertIdentifierIsFree,
  assertNoTokenNamedLikeDimension,
};

/**
 * Two companies may use the same label; one company may not use it twice for the
 * same taxonomy. The unique index enforces this, but a duplicate would surface as
 * an E11000 rather than a usable error, so it is checked here too.
 */
async function assertLabelIsFree({ companyId, type, label, exceptId }) {
  // Case-insensitive: "Newsletter" and "newsletter" in the same curated list are a
  // mistake, not two typologies. Accent differences are NOT caught — that would
  // need a stored normalised field, and it is not the collision people actually
  // make. The unique index stays as the exact-match backstop.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    _company: companyId,
    type,
    label: { $regex: `^${escaped}$`, $options: 'i' },
  };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }

  if (await TaxonomyItems.exists(query)) {
    throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_LABEL_ALREADY_EXISTS);
  }
}

/**
 * One identifier per value within a dimension: a template compares against it,
 * and two values answering to the same one could not be told apart. Values with
 * no identifier are as many as needed.
 *
 * The email type is left out: there the field maps a value onto one of the
 * doctrine's six types, and several values map onto the same one.
 */
async function assertIdentifierIsFree({
  companyId,
  type,
  identifier,
  exceptId,
}) {
  if (!identifier || type === StandardDimensions.EMAIL_TYPE) return;

  const query = { _company: companyId, type, canonicalType: identifier };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }

  if (await TaxonomyItems.exists(query)) {
    throw new Conflict(ERROR_CODES.TAXONOMY_ITEM_IDENTIFIER_ALREADY_EXISTS);
  }
}

/**
 * A design token is never published under a dimension's name: the dimension
 * decides that property (ADR-0015). Refused when saved, rather than accepted
 * and then ignored by the editor without a word. Every declared dimension
 * counts, a deactivated one included, which may come back, and the two
 * standard ones, declared for every company even before they are seeded.
 *
 * @param {Object} params
 * @param {ObjectId|string} params.companyId
 * @param {Object} [params.tokens] the tokens a request sets, name → value
 */
async function assertNoTokenNamedLikeDimension({ companyId, tokens }) {
  const names = Object.keys(tokens || {});
  if (names.length === 0) return;

  const declared = await TaxonomyDimensions.find({
    _company: companyId,
    name: { $in: names },
  })
    .select({ name: 1 })
    .lean();
  const dimensionNames = new Set(
    StandardDimensionNames.concat(declared.map((dimension) => dimension.name))
  );
  const taken = names.find((name) => dimensionNames.has(name));
  if (taken) {
    const error = new Conflict(ERROR_CODES.TAXONOMY_TOKEN_NAME_IS_DIMENSION);
    error.details = { name: taken };
    throw error;
  }
}
