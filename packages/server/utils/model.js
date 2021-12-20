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

// Validate pagination JSON
function validateFiltersJSON(filters) {
  if (filters) {
    if (
      (filters?.templates && !Array.isArray(filters.templates)) ||
      (filters?.tags && !Array.isArray(filters.tags))
    ) {
      throw new BadRequest(ERROR_CODES.BAD_FORMAT_FILTERS);
    }
  }
  return filters;
}
