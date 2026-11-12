'use strict';

const {
  TaxonomyDimensions,
  TaxonomyItems,
} = require('../../common/models.common.js');
const {
  ROLES,
  composeLocale,
} = require('../../../shared/locale/locale-codes.js');

/**
 * The locale of an email (ADR-0023), computed at read time from the values it
 * carries and the roles the company's dimensions hold: never stored, so moving
 * a role or correcting a code reaches every email at once.
 *
 * Read by the governance context and the translation; the expertises and the
 * spelling correction will read it too.
 */
module.exports = { resolveEmailLocale, readEmailLocale };

/**
 * @param {Object} params
 * @param {Object} params.mailing with `_company` and `_taxonomyItems`
 * @returns {Promise<{language: (string|null), country: (string|null), locale: (string|null)}>}
 *   a part the email does not say is null: nothing is guessed
 */
async function resolveEmailLocale({ mailing }) {
  const { language, country, locale } = await readEmailLocale({ mailing });
  return { language, country, locale };
}

/**
 * The same, and whether the company has a dimension with a role at all: an
 * unknown language means something only to a company that declines its emails
 * by one.
 *
 * @returns {Promise<{language, country, locale, hasRole: boolean}>}
 */
async function readEmailLocale({ mailing }) {
  const companyId = mailing._company?._id || mailing._company;
  if (!companyId) return { ...composeLocale({}), hasRole: false };

  // Active dimensions only: a deactivated one says nothing to the template or
  // the AI any more (ADR-0014), its language included.
  const dimensions = await TaxonomyDimensions.find({
    _company: companyId,
    isActive: true,
    role: { $in: ROLES },
  })
    .select({ name: 1, role: 1 })
    .lean();
  if (dimensions.length === 0) return { ...composeLocale({}), hasRole: false };

  const ids = (mailing._taxonomyItems || []).filter(Boolean);
  // Within the email's company only: an id pointing elsewhere says nothing. A
  // deactivated value still counts: it is the one the email carries.
  const items = ids.length
    ? await TaxonomyItems.find({
        _id: { $in: ids },
        _company: companyId,
        type: { $in: dimensions.map((dimension) => dimension.name) },
      })
        .select({ type: 1, code: 1 })
        .lean()
    : [];

  const codes = dimensions.reduce((byRole, dimension) => {
    const item = items.find((candidate) => candidate.type === dimension.name);
    byRole[dimension.role] = (item && item.code) || null;
    return byRole;
  }, {});

  return { ...composeLocale(codes), hasRole: true };
}
