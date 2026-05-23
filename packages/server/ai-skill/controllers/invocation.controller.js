'use strict';

const asyncHandler = require('express-async-handler');
const invocationService = require('../services/invocation-log.service.js');

module.exports = {
  listInvocations: asyncHandler(async (req, res) => {
    res.json(await invocationService.listInvocations(req.query));
  }),
  getInvocation: asyncHandler(async (req, res) => {
    res.json(await invocationService.getInvocation(req.params.id));
  }),
};
