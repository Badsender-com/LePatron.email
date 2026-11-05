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

// What a search may be, at most: a title or an id, never a page of text.
const MAX_SEARCH_LENGTH = 100;
// The expertises a list reads by id, at most: those a version consumes.
const MAX_LISTED_IDS = MaxConsumedExpertises;

// A query string value is a string, or a list of them, or an object Express
// built from `?status[$ne]=`: only a string is a filter.
function oneOf(value, allowed, code) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw createError(400, code);
  }
  return value;
}

// The text is matched as written, whatever its case: escaped, never a
// pattern the client wrote.
function searchFilter(search) {
  if (search === undefined) return null;
  if (typeof search !== 'string' || search.length > MAX_SEARCH_LENGTH) {
    throw createError(400, ERROR_CODES.EXPERTISE_SEARCH_INVALID, {
      max: MAX_SEARCH_LENGTH,
    });
  }
  const text = search.trim();
  if (!text) return null;
  const pattern = new RegExp(escapeRegex(text), 'i');
  return { $or: [{ title: pattern }, { expertiseId: pattern }] };
}

// `?ids=a` or `?ids=a&ids=b`: expertise ids, a few of them.
function idsFilter(ids) {
  if (ids === undefined) return null;
  const list = Array.isArray(ids) ? ids : [ids];
  const valid =
    list.length > 0 &&
    list.length <= MAX_LISTED_IDS &&
    list.every(
      (id) =>
        typeof id === 'string' &&
        id.length <= MaxSkillIdLength &&
        SkillIdRegex.test(id)
    );
  if (!valid) {
    throw createError(400, ERROR_CODES.EXPERTISE_IDS_INVALID, {
      max: MAX_LISTED_IDS,
    });
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
 *   whatever the case, MAX_SEARCH_LENGTH characters at most
 * @param {string|string[]} [filters.ids] these expertises exactly, whatever
 *   their status unless `status` names one, MAX_LISTED_IDS at most
 * @returns {Object} the filter of the query
 * @throws {HttpError} 400 EXPERTISE_LIST_FILTER_INVALID,
 *   EXPERTISE_SEARCH_INVALID or EXPERTISE_IDS_INVALID (each with `max`)
 */
function listFilter({ category, status, search, ids }) {
  const invalid = ERROR_CODES.EXPERTISE_LIST_FILTER_INVALID;
  const query = {};
  const categoryValue = oneOf(category, SkillCategoryValues, invalid);
  const statusValue = oneOf(status, SkillStatusValues, invalid);
  if (categoryValue) query.category = categoryValue;
  if (statusValue) query.status = statusValue;
  return Object.assign(query, searchFilter(search), idsFilter(ids));
}

module.exports = { listFilter, MAX_SEARCH_LENGTH, MAX_LISTED_IDS };
