'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');

/**
 * A read token of production (ADR 0019): what a copy (staging, development)
 * reads production's skills and expertises with. A super admin creates it,
 * named after the copy it serves, and revokes it. The token itself is shown
 * once, at creation: only its SHA-256 hash is kept. A revoked token stays,
 * for the record, and reads nothing.
 */
const SkillsReadTokenSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  tokenHash: { type: String, required: true, unique: true },
  _createdBy: { type: ObjectId, ref: UserModel },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
});

module.exports = SkillsReadTokenSchema;
