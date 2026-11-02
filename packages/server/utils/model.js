'use strict';

const { BadRequest } = require('http-errors');
const SPACE_TYPE = require('../constant/space-type');
const ERROR_CODES = require('../constant/error-codes.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

module.exports = {
  isObjectIdString,
  trimString,
  normalizeString,
  addGroupFilter,
  addMailQueryParamFilter,
  validatePaginationJSON,
  validateFiltersJSON,
  parseQueryJSON,
};

// A 24-hex-digit id, as the routes receive it. Mongoose alone also accepts any
// 12-character string, and lets "undefined" reach a cast that fails as a
// server error.
function isObjectIdString(value) {
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
}

// normalize string to have a better ordering
function normalizeString(string) {
  string = String(string);
  return trimString(string).toLowerCase();
}

function trimString(string) {
  string = String(string);
  return string.trim();
}

// users can access only same group content
// admin everything
function addGroupFilter(user, filter) {
  if (permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) return filter;
  filter._company = user.group.id;
  return filter;
}

// Filter from params query
function addMailQueryParamFilter(query) {
  const params = {};
  if (query?.type === SPACE_TYPE.FOLDER) {
    params._parentFolder = query.id;
  } else if (query?.type === SPACE_TYPE.WORKSPACE) {
    params._workspace = query.id;
  }
  return params;
}

/**
 * A JSON object sent as a query-string parameter (a listing's pagination or
 * filters): absent is empty, malformed is the caller's mistake, a 400 rather
 * than the 500 a bare JSON.parse throws.
 *
 * @param {string} [value] the raw parameter
 * @param {string} errorCode what to answer when it is not a JSON object
 * @returns {Object}
 */
function parseQueryJSON(value, errorCode) {
  if (value === undefined || value === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BadRequest(errorCode);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequest(errorCode);
  }
  return parsed;
}

// Validate pagination JSON
function validatePaginationJSON(pagination) {
  if (pagination) {
    if (
      (pagination?.page && Number.isNaN(pagination.page)) ||
      (pagination?.itemsPerPage && Number.isNaN(pagination.itemsPerPage)) ||
      (pagination?.pageStart && Number.isNaN(pagination.pageStart)) ||
      (pagination?.pageStop && Number.isNaN(pagination.pageStop)) ||
      (pagination?.pageCount && Number.isNaN(pagination.pageCount)) ||
      (pagination?.itemsLength && Number.isNaN(pagination.itemsLength))
    ) {
      throw new BadRequest(ERROR_CODES.BAD_FORMAT_PAGINATION);
    }
  }
  return pagination;
}

// The filters come from a JSON query-string parameter, so nothing about their
// shape is guaranteed. Anything that reaches a typed schema path (an ObjectId, a
// Date) must be checked here: Mongoose would otherwise raise a CastError, which
// surfaces as a 500 instead of a 400. Keeping this as a table rather than a chain
// of `||` means a new filter is one line, and cannot be forgotten silently.
const FILTER_SHAPES = {
  name: 'string',
  templates: 'ids',
  tags: 'strings',
  createdAtStart: 'date',
  createdAtEnd: 'date',
  updatedAtStart: 'date',
  updatedAtEnd: 'date',
};

// A single query cannot legitimately enumerate more than this; an unbounded $in
// is a cheap way to make the database do a lot of work.
const MAX_FILTER_ARRAY_LENGTH = 200;
// A name is matched as a pattern on every email in scope: longer than any
// email name, it only costs the database.
const MAX_FILTER_NAME_LENGTH = 200;

// Each validator answers with the error to raise, or null when the value passes.
// Shape and size are distinguished on purpose: an over-long list is well formed,
// so reporting it as a format error sends whoever reads the log looking for a
// malformation that is not there.
const FILTER_VALIDATORS = {
  string: (value, key) => {
    if (typeof value !== 'string') {
      return badFilters(
        ERROR_CODES.BAD_FORMAT_FILTERS,
        `${key} must be a string`
      );
    }
    if (value.length > MAX_FILTER_NAME_LENGTH) {
      return badFilters(
        ERROR_CODES.FILTER_TOO_LONG,
        `${key}: ${value.length} characters, maximum is ${MAX_FILTER_NAME_LENGTH}`
      );
    }
    return null;
  },
  // A day as the date pickers send it; empty is no bound.
  date: (value, key) =>
    value === '' ||
    (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
      ? null
      : badFilters(ERROR_CODES.BAD_FORMAT_FILTERS, `${key} must be a date`),
  strings: (value, key) =>
    listError(value, key) ||
    (value.every((item) => typeof item === 'string')
      ? null
      : badFilters(ERROR_CODES.BAD_FORMAT_FILTERS, `${key} must hold strings`)),
  ids: (value, key) =>
    listError(value, key) ||
    (value.every(isObjectIdString)
      ? null
      : badFilters(ERROR_CODES.BAD_FORMAT_FILTERS, `${key} must hold ids`)),
};

// A list filter, well formed and short enough to reach a `$in`.
function listError(value, key) {
  if (!Array.isArray(value)) {
    return badFilters(
      ERROR_CODES.BAD_FORMAT_FILTERS,
      `${key} must be an array`
    );
  }
  if (value.length > MAX_FILTER_ARRAY_LENGTH) {
    return badFilters(
      ERROR_CODES.FILTER_TOO_MANY_VALUES,
      `${key}: ${value.length} entries, maximum is ${MAX_FILTER_ARRAY_LENGTH}`
    );
  }
  return null;
}

// Same contract as sanitizeEmailMetadata: the code is what the front switches
// on, the human-readable reason travels in `.details` so a support ticket
// becomes a log read.
function badFilters(code, details) {
  const err = new BadRequest(code);
  err.details = details;
  return err;
}

// Validate the filters JSON
function validateFiltersJSON(filters) {
  if (filters) {
    Object.entries(FILTER_SHAPES).forEach(([key, shape]) => {
      if (filters[key] == null) return;
      const error = FILTER_VALIDATORS[shape](filters[key], key);
      if (error) throw error;
    });
  }
  return filters;
}
