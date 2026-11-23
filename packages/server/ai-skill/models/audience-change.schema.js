'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');
const { AudienceValues } = require('../constant/skill-constants.js');

/**
 * A change of an item's audience (ADR 0031): opened to every company, or
 * kept to the platform company again, when and by whom. The catalog changes
 * a company reads are dated from it; before the first one, the item stood
 * at the other audience.
 */
const AudienceChangeSchema = new Schema(
  {
    audience: { type: String, enum: AudienceValues, required: true },
    at: { type: Date, required: true },
    _by: { type: ObjectId, ref: UserModel, default: null },
  },
  { _id: false }
);

// What both an expertise and a skill keep of their audience and their end.
const audienceHistoryFields = () => ({
  audienceHistory: { type: [AudienceChangeSchema], default: [] },
  // When it was archived: withdrawn from every company that read it.
  archivedAt: { type: Date, default: null },
});

module.exports = { AudienceChangeSchema, audienceHistoryFields };
