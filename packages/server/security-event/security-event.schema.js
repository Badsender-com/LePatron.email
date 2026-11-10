'use strict';

const { Schema } = require('mongoose');

const { UserModel, GroupModel } = require('../constant/model.names.js');
const {
  SECURITY_EVENT_ACTIONS,
  SECURITY_EVENT_TTL_SECONDS,
  TWO_FACTOR_METHODS,
} = require('./security-event.actions.js');

const { ObjectId } = Schema.Types;

// An action on an account's two-factor authentication, or on a company's MCP
// access, retex, clients registered by hand or connected applications (ADR
// 0012): who did it, to whom, when (ADR 0008). Kept a year, then removed by
// the TTL index. Not the `Log` collection, whose fields are those
// of the ESP SOAP calls.
const SecurityEventSchema = Schema(
  {
    action: {
      type: String,
      enum: SECURITY_EVENT_ACTIONS,
      required: true,
    },
    // The account acted on; none when the action is on a group.
    user: { type: ObjectId, ref: UserModel },
    // Who acted, when it is not the account itself.
    actor: { type: ObjectId, ref: UserModel },
    group: { type: ObjectId, ref: GroupModel },
    // The verification method of a two-factor event.
    method: { type: String, enum: Object.values(TWO_FACTOR_METHODS) },
    // The client of an MCP client event (`mcp-client.…`): its id and its
    // name, never its secret.
    clientId: { type: String },
    clientName: { type: String },
    // The read token of a `skills-read-token.…` event: its id and its name,
    // never the token.
    readTokenId: { type: String },
    readTokenName: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SecurityEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: SECURITY_EVENT_TTL_SECONDS }
);

module.exports = SecurityEventSchema;
