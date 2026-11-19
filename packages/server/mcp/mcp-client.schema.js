'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel, GroupModel } = require('../constant/model.names.js');

/**
 * A client registered by hand (ADR 0012), by a company's tech admin or a super
 * admin, for the assistants that cannot register themselves (Copilot Studio
 * in manual mode): what the company's settings list, and what the
 * authorization server reads it by (mcp-clients.js). It belongs to the
 * company: its users alone connect through it. Its secret is kept as its
 * digest: it is answered once, at creation.
 */
const McpClientSchema = new Schema(
  {
    clientId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    redirectUris: { type: [String], default: [] },
    tokenEndpointAuthMethod: { type: String, required: true },
    secretDigest: { type: String, required: true, select: false },
    _company: { type: ObjectId, ref: GroupModel, required: true, index: true },
    _createdBy: { type: ObjectId, ref: UserModel },
  },
  { timestamps: true }
);

module.exports = McpClientSchema;
