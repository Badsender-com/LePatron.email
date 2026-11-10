'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel, GroupModel } = require('../constant/model.names.js');

const AboutSchema = new Schema(
  {
    kind: { type: String, enum: ['skill', 'expertise'], required: true },
    id: { type: String, required: true },
    version: { type: String, required: true },
  },
  { _id: false }
);

/**
 * A retex (ADR 0021): what a user's work taught about a skill or an expertise,
 * a divergence or a complement, never a summary of the session. The author is
 * kept for the company's sake, and never shown: a reader sees the company and
 * whether the author was a consultant of the platform company or a client
 * user. Open, it has no expiry; addressed or dismissed, it follows the
 * company's log retention.
 *
 * A client user's retex belongs to their company. A consultant's belongs to
 * the platform company, whatever company they connected to: it is their
 * know-how, not their client's words, and it outlives the client.
 */
const McpRetexSchema = new Schema(
  {
    _company: { type: ObjectId, ref: GroupModel, required: true },
    // The company of the connection it was reported from, as context only:
    // a consultant's client. Emptied when that company is deleted.
    _connectedCompany: { type: ObjectId, ref: GroupModel, default: null },
    _user: { type: ObjectId, ref: UserModel, required: true },
    author: { type: String, enum: ['consultant', 'client'], required: true },
    clientId: { type: String, default: '' },
    // When a client user's approval was given, as the assistant said so: a
    // super admin's retex asks for none.
    approvedAt: { type: Date, default: null },
    kind: { type: String, enum: ['divergence', 'complement'], required: true },
    // What it is about; null for a complement about no skill or expertise,
    // which names a kind of know-how and a part of the email instead.
    about: { type: AboutSchema, default: null },
    category: { type: String, default: null },
    part: { type: String, default: null },
    // The passage: an expertise's section anchor, or a quotation of a skill.
    section: { type: String, default: null },
    quote: { type: String, default: null },
    // A divergence.
    recommended: { type: String, default: null },
    decided: { type: String, default: null },
    why: { type: String, default: null },
    // A complement.
    missing: { type: String, default: null },
    brought: { type: String, default: null },
    source: { type: String, default: null },
    status: {
      type: String,
      enum: ['open', 'addressed', 'dismissed'],
      default: 'open',
    },
    addressedIn: { type: String, default: null },
    dismissal: {
      type: new Schema(
        { reason: { type: String, required: true }, _user: ObjectId },
        { _id: false }
      ),
      default: null,
    },
    closedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

McpRetexSchema.index({ status: 1, createdAt: -1 });
McpRetexSchema.index({ status: 1, 'about.kind': 1, 'about.id': 1 });
McpRetexSchema.index({ status: 1, category: 1, part: 1 });
// A change of the company's retention re-stamps its closed retex
// (group/log-retention.js).
McpRetexSchema.index({ _company: 1, closedAt: -1 });
McpRetexSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = McpRetexSchema;
