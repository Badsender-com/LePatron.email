'use strict';

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const { escapeRegex } = require('../../utils/query-scalars.js');
const {
  SkillStatusValues,
  SkillCategoryValues,
  SkillIdRegex,
  MaxSkillIdLength,
  MaxConsumedExpertises,
} = require('../constant/skill-constants.js');
const {
  EXPERTISE_SEARCH_MAX_LENGTH,
} = require('../../../shared/ai-skill/constants.js');

// Each refusal names its filter, and the bound it went past, if any.
const refuse = (filter, max) =>
  createError(400, ERROR_CODES.EXPERTISE_LIST_FILTER_INVALID, {
    filter,
    ...(max ? { max } : {}),
  });

// A query string value is a string, or a list of them, or an object Express
// built from `?status[$ne]=`: only a string is a filter.
function oneOf(value, allowed, filter) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw refuse(filter);
  }
  return value;
}

// The text is matched as written, whatever its case: escaped, never a
// pattern the client wrote.
function searchFilter(search) {
  if (search === undefined) return null;
  if (
    typeof search !== 'string' ||
    search.length > EXPERTISE_SEARCH_MAX_LENGTH
  ) {
    throw refuse('search', EXPERTISE_SEARCH_MAX_LENGTH);
  }
  const text = search.trim();
  if (!text) return null;
  const pattern = new RegExp(escapeRegex(text), 'i');
  return { $or: [{ title: pattern }, { expertiseId: pattern }] };
}

// `?ids=a` or `?ids=a&ids=b`: expertise ids, no more than a version
// consumes.
function idsFilter(ids) {
  if (ids === undefined) return null;
  const list = Array.isArray(ids) ? ids : [ids];
  const valid =
    list.length > 0 &&
    list.length <= MaxConsumedExpertises &&
    list.every(
      (id) =>
        typeof id === 'string' &&
        id.length <= MaxSkillIdLength &&
        SkillIdRegex.test(id)
    );
  if (!valid) {
    throw refuse('ids', MaxConsumedExpertises);
  }
  return { expertiseId: { $in: list } };
}

/**
 * The query of the expertise list, from what the query string gives: each
 * filter is a value of its kind, or refused, never a query operator.
 *
 * @param {Object} filters
 * @param {string} [filters.category] one of the categories
 * @param {string} [filters.status] one of the statuses
 * @param {string} [filters.search] found in the title or the expertiseId,
 *   whatever the case, EXPERTISE_SEARCH_MAX_LENGTH characters at most
 * @param {string|string[]} [filters.ids] these expertises exactly, whatever
 *   their status unless `status` names one, MaxConsumedExpertises at most
 * @returns {Object} the filter of the query
 * @throws {HttpError} 400 EXPERTISE_LIST_FILTER_INVALID, with the `filter`
 *   refused and, for `search` and `ids`, the `max` it takes
 */
function listFilter({ category, status, search, ids }) {
  const query = {};
  const categoryValue = oneOf(category, SkillCategoryValues, 'category');
  const statusValue = oneOf(status, SkillStatusValues, 'status');
  if (categoryValue) query.category = categoryValue;
  if (statusValue) query.status = statusValue;
  return Object.assign(query, searchFilter(search), idsFilter(ids));
}

module.exports = { listFilter };
