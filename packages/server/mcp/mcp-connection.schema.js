'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel, GroupModel } = require('../constant/model.names.js');

/**
 * A connected application (ADR 0012): one consent of a user, bound to a
 * group, and the grant the authorization server keeps for it. What the user
 * lists and revokes; `/mcp` checks it is still here at every call. It goes
 * with its grant.
 */
const McpConnectionSchema = new Schema({
  grantId: { type: String, required: true, unique: true },
  clientId: { type: String, required: true, index: true },
  // As the application named itself at consent.
  clientName: { type: String, required: true },
  _user: { type: ObjectId, ref: UserModel, required: true, index: true },
  _company: { type: ObjectId, ref: GroupModel, required: true, index: true },
  connectedAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = McpConnectionSchema;
