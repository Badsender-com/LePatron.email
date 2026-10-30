'use strict';

const { Schema } = require('mongoose');

const { UserModel, GroupModel } = require('../constant/model.names.js');
const {
  SECURITY_ACTIONS,
  METHODS,
  SECURITY_EVENT_TTL_SECONDS,
} = require('./two-factor.constants.js');

const { ObjectId } = Schema.Types;

// An action on an account's two-factor authentication: who did it, to whom,
// when (ADR 0008). Kept a year, then removed by the TTL index. Not the `Log`
// collection, whose fields are those of the ESP SOAP calls.
const SecurityEventSchema = Schema(
  {
    action: {
      type: String,
      enum: Object.values(SECURITY_ACTIONS),
      required: true,
    },
    // The account acted on; none when the action is on a group.
    user: { type: ObjectId, ref: UserModel },
    // Who acted, when it is not the account itself.
    actor: { type: ObjectId, ref: UserModel },
    group: { type: ObjectId, ref: GroupModel },
    method: { type: String, enum: Object.values(METHODS) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SecurityEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: SECURITY_EVENT_TTL_SECONDS }
);

module.exports = SecurityEventSchema;
