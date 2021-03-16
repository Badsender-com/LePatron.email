'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const { Templates } = require('../common/models.common.js');

module.exports = {
  findOne: asyncHandler(findOne),
};

async function findOne({ templateId }) {
  return Templates.findOne({_id : mongoose.Types.ObjectId(templateId)});
}


