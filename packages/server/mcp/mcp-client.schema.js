'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../constant/model.names.js');

/**
 * A client a super admin registered by hand (ADR 0012), for the assistants
 * that cannot register themselves (Copilot Studio in manual mode): what the
 * back office lists. Its OAuth metadata and its secret are the authorization
 * server's, kept with the clients that registered (DCR); the secret is never
 * here.
 */
const McpClientSchema = new Schema(
  {
    clientId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    redirectUris: { type: [String], default: [] },
    tokenEndpointAuthMethod: { type: String, required: true },
    _createdBy: { type: ObjectId, ref: UserModel },
  },
  { timestamps: true }
);

module.exports = McpClientSchema;
