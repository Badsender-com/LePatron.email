'use strict';

const mongoose = require('mongoose');
const { BadRequest } = require('http-errors');
const SPACE_TYPE = require('../constant/space-type');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  trimString,
  normalizeString,
  isFromGroup,
  addGroupFilter,
  addStrictGroupFilter,
  addMailQueryParamFilter,
  validatePaginationJSON,
  validateFiltersJSON,
};

// normalize string to have a better ordering
function normalizeString(string) {
  string = String(string);
  return trimString(string).toLowerCase();
}

function trimString(string) {
  string = String(string);
  return string.trim();
}

// TODO: check where it's used
function isFromGroup(user, groupId) {
  if (!user) return false;
  if (user.isAdmin) return true;
  // creations from admin doesn't gave a groupId
  if (!groupId) return false;
  return String(user._company) === String(groupId);
}

// users can access only same group content
// admin everything
function addGroupFilter(user, filter) {
  if (user.isAdmin) return filter;
  filter._company = user.group.id;
  return filter;
}

// Strict difference from above:
// Admin can't get content with a group
function addStrictGroupFilter(user, filter) {
  const group = user.isAdmin ? { $exists: false } : user.group.id;
  filter._company = mongoose.Types.ObjectId(group);
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
  templates: 'array',
  tags: 'array',
};

// A single query cannot legitimately enumerate more than this; an unbounded $in
// is a cheap way to make the database do a lot of work.
const MAX_FILTER_ARRAY_LENGTH = 200;

// Each validator answers with the error to raise, or null when the value passes.
// Shape and size are distinguished on purpose: an over-long list is well formed,
// so reporting it as a format error sends whoever reads the log looking for a
// malformation that is not there.
const FILTER_VALIDATORS = {
  array: (value, key) => {
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
  },
};

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
