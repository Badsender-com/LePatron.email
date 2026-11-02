'use strict';

const asyncHandler = require('express-async-handler');

const ERROR_CODES = require('../constant/error-codes.js');
const {
  parseQueryJSON,
  validatePaginationJSON,
  validateFiltersJSON,
} = require('../utils/model.js');
const { searchMailings } = require('./mailing-search.service.js');

module.exports = { search: asyncHandler(search) };

/**
 * @api {get} /mailings/search search every accessible workspace
 * @apiPermission user
 * @apiName SearchMailings
 * @apiGroup Mailings
 *
 * @apiParam (Query) {String} [pagination] the listing's pagination, as JSON
 * @apiParam (Query) {String} [filters] the listing's filters, as JSON
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items.docs each with its `location` and `hasAccess`
 */

async function search(req, res) {
  const { user, query } = req;
  const pagination = validatePaginationJSON(
    parseQueryJSON(query.pagination, ERROR_CODES.BAD_FORMAT_PAGINATION)
  );
  const filters = validateFiltersJSON(
    parseQueryJSON(query.filters, ERROR_CODES.BAD_FORMAT_FILTERS)
  );

  res.json(await searchMailings({ user, filters, pagination }));
}
