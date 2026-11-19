'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const { UserModel } = require('../../constant/model.names.js');

/**
 * What a skill or an expertise of a copy holds of its follow of production
 * (ADR 0019), the same on both models.
 *
 * - `followedAt`: when a follow last wrote it; unset on an item written on
 *   the copy, which no follow touches.
 * - `followedDigest`: production's item as the copy last followed it, to
 *   tell an item kept on the copy whether production changed since.
 * - `keptOnCopy`: the follow leaves it as the copy has it, until someone
 *   follows production again; who decided it, and when.
 * - `copiedFrom`: the item the copy's own work came from, for an item a
 *   follow or a duplication created on the copy.
 *
 * A function, so each schema gets definitions of its own.
 */
const followFields = () => ({
  followedAt: { type: Date },
  followedDigest: { type: String },
  keptOnCopy: { type: Boolean, default: false },
  keptOnCopyAt: { type: Date },
  _keptOnCopyBy: { type: ObjectId, ref: UserModel },
  copiedFrom: { type: String },
});

module.exports = { followFields };
