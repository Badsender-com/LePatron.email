'use strict';

const { Conflict } = require('http-errors');

const { TaxonomyItems } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');
const {
  TaxonomyLimits,
  TaxonomyTypes,
} = require('../constant/taxonomy-type.js');
const {
  buildDefaultEmailTypes,
  planMissingDefaultEmailTypes,
} = require('./default-email-types.js');
const { resolveCompanyId } = require('./taxonomy.service.js');
const logger = require('../utils/logger.js');

/**
 * The Badsender default email types, written into a company's taxonomy: the
 * automatic seed at company creation, and the admin's "restore the defaults".
 *
 * Kept apart from taxonomy.service.js, which is the CRUD of items one at a time:
 * this is the one place that writes a whole vocabulary on the company's behalf,
 * with its own rules about when to stay out of what an admin has started.
 */
module.exports = {
  seedDefaultEmailTypes,
  previewMissingDefaultEmailTypes,
  addMissingDefaultEmailTypes,
};

/**
 * Creates the six Badsender email types for a company that has none.
 *
 * Idempotent, and deliberately all-or-nothing on "does this company already have
 * email types": if there is even one, the company has started its own vocabulary
 * and the seed stays out of it. Topping up a partial list would resurrect items an
 * admin deleted on purpose, and could collide with the unique index on
 * `{_company, type, label}` — a renamed "Éditorial" leaves the label free.
 *
 * Callers must treat a failure as non-fatal: a company that exists without its
 * default typologies is a nuisance an admin fixes in one screen, or the seeding
 * script fixes in bulk. A company creation that fails because of it is not.
 *
 * @param {Object} params
 * @param {ObjectId|string} params.companyId
 * @param {string} [params.lang] `fr` or `en`; anything else falls back to `en`
 * @returns {Promise<Array>} the items created — empty when the company already had some
 */
async function seedDefaultEmailTypes({ companyId, lang }) {
  logger.log('taxonomyDefaultsService:seedDefaultEmailTypes');

  const type = TaxonomyTypes.EMAIL_TYPE;

  const existingCount = await TaxonomyItems.countDocuments({
    _company: companyId,
    type,
  });

  if (existingCount > 0) return [];

  const items = buildDefaultEmailTypes(lang).map((item) => ({
    ...item,
    _company: companyId,
    type,
  }));

  try {
    return await TaxonomyItems.insertMany(items, { ordered: true });
  } catch (error) {
    // Two creations racing on the same brand-new company. The unique index holds,
    // the loser has nothing left to do: the types are there either way.
    if (error?.code === 11000) {
      logger.warn(
        `taxonomyDefaultsService:seedDefaultEmailTypes: already seeded for company ${companyId}`
      );
      return [];
    }
    throw error;
  }
}

/**
 * Reads the company's email types and returns what restoring the defaults would
 * do — without writing anything.
 *
 * Exists so the confirmation dialog names the typologies it is about to create.
 * A confirmation that says "this will add the missing default types" and nothing
 * more asks the user to approve a number they cannot see.
 *
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] company to read, super admin only
 * @param {string} [params.lang]
 * @returns {Promise<{toCreate: Array, skipped: Array}>}
 */
async function previewMissingDefaultEmailTypes({ user, groupId, lang }) {
  logger.log('taxonomyDefaultsService:previewMissingDefaultEmailTypes');

  const companyId = resolveCompanyId(user, groupId);
  const existing = await TaxonomyItems.find({
    _company: companyId,
    type: TaxonomyTypes.EMAIL_TYPE,
  })
    .select({ label: 1, canonicalType: 1 })
    .lean();

  return planMissingDefaultEmailTypes(existing, lang);
}

/**
 * Creates the default email types the company does not have.
 *
 * The admin-facing counterpart of `seedDefaultEmailTypes`, and deliberately NOT
 * the same rule. The seed runs once, on a company that has nothing, and gives up
 * the moment it finds anything — it must never touch a vocabulary someone has
 * started. This one is asked for explicitly, by someone looking at the list, so it
 * repairs: a company created before the seed existed, or a type deleted by
 * mistake. What the two share is `planMissingDefaultEmailTypes`, and on an empty
 * company they do exactly the same thing.
 *
 * Recomputed here rather than trusting what the preview returned: the two calls
 * are seconds apart, but a payload of items to create would let a caller write
 * whatever it liked into the taxonomy.
 *
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] company to write to, super admin only
 * @param {string} [params.lang]
 * @returns {Promise<{created: Array, skipped: Array}>}
 */
async function addMissingDefaultEmailTypes({ user, groupId, lang }) {
  logger.log('taxonomyDefaultsService:addMissingDefaultEmailTypes');

  const companyId = resolveCompanyId(user, groupId);
  const type = TaxonomyTypes.EMAIL_TYPE;

  const existing = await TaxonomyItems.find({ _company: companyId, type })
    .select({ label: 1, canonicalType: 1 })
    .lean();

  const { toCreate, skipped } = planMissingDefaultEmailTypes(existing, lang);

  if (toCreate.length === 0) return { created: [], skipped };

  // Same cap as createTaxonomyItem, checked before the write rather than letting
  // six inserts take a company past it one at a time.
  if (existing.length + toCreate.length > TaxonomyLimits.ITEMS_PER_COMPANY) {
    throw new Conflict(ERROR_CODES.TAXONOMY_LIMIT_REACHED);
  }

  const items = toCreate.map((item) => ({
    ...item,
    _company: companyId,
    type,
  }));

  try {
    const created = await TaxonomyItems.insertMany(items, { ordered: true });
    return { created, skipped };
  } catch (error) {
    // The label comparison in the plan is looser than the index, so this is the
    // narrower case it cannot see: two admins clicking the button at the same
    // moment. The other one's items are in, which is the outcome either was after.
    //
    // An ordered insert stops at the first duplicate but keeps what it wrote
    // before it. Mongoose lists those in `insertedDocs`: returning `[]` instead
    // would have the snackbar say nothing was added while some were.
    if (error?.code === 11000) {
      logger.warn(
        `taxonomyDefaultsService:addMissingDefaultEmailTypes: concurrent restore on company ${companyId}`
      );
      return { created: error.insertedDocs || [], skipped };
    }
    throw error;
  }
}
