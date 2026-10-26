'use strict';

const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const bcrypt = require('bcryptjs');
const validator = require('validator');
const randToken = require('rand-token');
const moment = require('moment');
const mongooseHidden = require('mongoose-hidden')();

const config = require('../node.config.js');
const mail = require('../mailing/mail.service.js');
const {
  renderEmail,
  siteOrigin,
  PASSWORD_TEXTS,
} = require('../email-templates/email-template.js');
const Roles = require('../account/roles');
const { normalizeString } = require('../utils/model');
const { GroupModel } = require('../constant/model.names.js');
const TwoFactorSchema = require('../two-factor/two-factor.schema.js');
const { METHODS } = require('../two-factor/two-factor.constants.js');

/**
 * @apiDefine users
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {String} externalUsername
 * @apiSuccess {Date} createdAt creation date
 * @apiSuccess {Date} updatedAt last update date
 * @apiSuccess {String} lang selected langue of the user
 * @apiSuccess {Boolean} isReinitialized wether the password has been reinitialized or not
 * @apiSuccess {Boolean} isDeactivated wether this account has been deactivated or not
 * @apiSuccess {String} role one of the product's roles (packages/shared/access/roles.js)
 * @apiSuccess {String} status on string of `deactivated` | `confirmed` | `password-mail-sent` | `to-be-initialized`
 * @apiSuccess {Object} group The group it belongs to
 * @apiSuccess {String} group.id
 * @apiSuccess {String} group.name
 */

/// ///
// USER
/// ///

const UserSchema = Schema(
  {
    name: { type: String, set: normalizeString },
    role: {
      type: String,
      enum: Object.values(Roles),
      required: false,
    },
    externalUsername: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      // http://mongoosejs.com/docs/api.html#schematype_SchemaType-unique
      // from mongoose doc:
      // violating the constraint returns an E11000 error from MongoDB when saving, not a Mongoose validation error.
      unique: true,
      validate: [
        {
          validator: validator.isEmail,
          message: '{VALUE} is not a valid email address',
        },
      ],
      set: normalizeString,
    },
    _company: {
      type: ObjectId,
      ref: GroupModel,
      required: [true, 'Group is required'],
      // Ideally we should have run a script to migrate fields
      // • don't have time
      // • so just make an alias
      alias: 'group',
    },
    password: { type: String, set: encodePassword },
    lang: { type: String, default: 'en' },
    token: { type: String },
    tokenExpire: { type: Date },
    isDeactivated: { type: Boolean, default: false },
    // Session management fields
    activeSessionId: { type: String, select: false },
    sessionMetadata: {
      type: {
        ip: String,
        userAgent: String,
        loginTime: Date,
      },
      required: false,
      select: false,
    },
    lastActivity: { type: Date, default: Date.now },
    // Two-factor authentication (ADR 0008): the verification method the
    // member set up, none before the setup or after a reset. What checks it
    // is never sent, nor read unless asked for.
    twoFactorMethod: { type: String, enum: Object.values(METHODS) },
    twoFactor: { type: TwoFactorSchema, select: false },
    // The group a super admin works in (ADR 0002, amended): resolved on every
    // request by account/selected-group.js, fallbacks included.
    _selectedGroup: { type: ObjectId, ref: GroupModel },
    localStorage: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    // AI Playground — daily run quota (ai-playground/services/test-budget).
    // `date` is the YYYY-MM-DD bucket; resets when a run comes in on a new day.
    dailyTestInvocationCount: {
      date: { type: String, default: null },
      count: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// easily hide keys from toJSON
// https://www.npmjs.com/package/mongoose-hidden
UserSchema.plugin(mongooseHidden, {
  hidden: {
    _id: true,
    __v: true,
    password: true,
    token: true,
    activeSessionId: true,
    sessionMetadata: true,
    lastActivity: true,
    twoFactor: true,
  },
});

function encodePassword(password) {
  if (typeof password === 'undefined') return;
  return bcrypt.hashSync(password, 10);
}

UserSchema.virtual('status').get(function () {
  const status = this.isDeactivated
    ? 'deactivated'
    : this._company.issuer &&
      this._company.issuer.length > 0 &&
      this._company.entryPoint &&
      this._company.entryPoint.length > 0
    ? 'saml-authentication'
    : this.password
    ? 'confirmed'
    : this.token
    ? 'password-mail-sent'
    : 'to-be-initialized';
  return status;
});

UserSchema.virtual('isReinitialized').get(function () {
  if (this.password) return false;
  if (this.token) return true;
  return false;
});

UserSchema.methods.activate = function activate() {
  const user = this;
  user.isDeactivated = false;
  return user.save();
};

UserSchema.methods.deactivate = function deactivate() {
  const user = this;
  user.password = undefined;
  user.token = undefined;
  user.tokenExpire = undefined;
  user.isDeactivated = true;
  return user.save();
};

// `type` is 'admin' when an administrator resets the account (the current
// password stops working at once and the open sessions end) or 'user' when
// the person asked for a new one (the current password and the open sessions
// keep working until the emailed link is used, so that asking in someone's
// name locks nobody out).
UserSchema.methods.resetPassword = async function resetPassword(type, lang) {
  const user = this;
  if (type !== 'user') {
    user.password = undefined;
    // No session carries this id: the session validation ends them all.
    user.activeSessionId = randToken.generate(30);
  }
  user.token = randToken.generate(30);
  user.tokenExpire = moment().add(1, 'weeks');
  lang = lang || 'en';

  const updatedUser = await user.save();
  const resetUrl = `${siteOrigin()}/account/${updatedUser.email}/password/${
    user.token
  }`;
  await mail.send({
    to: updatedUser.email,
    subject: `${config.emailOptions.passwordSubjectPrefix} – Password reset`,
    text: `here is the link to enter your new password ${resetUrl}`,
    html: renderEmail(PASSWORD_TEXTS['reset-password'], lang, {
      type: type,
      url: resetUrl,
    }),
  });

  return updatedUser;
};

UserSchema.methods.setPassword = async function setPassword(password, lang) {
  const user = this;
  user.token = undefined;
  user.tokenExpire = undefined;
  user.password = password;
  lang = lang || 'en';

  const updatedUser = await user.save();
  const loginUrl = `${siteOrigin()}/account/login`;
  await mail.send({
    to: updatedUser.email,
    subject: `${config.emailOptions.passwordSubjectPrefix} – password reset`,
    text: `your password has been successfully been reinitialized. connect at ${loginUrl}`,
    html: renderEmail(PASSWORD_TEXTS['reset-success'], lang, {
      type: 'admin',
      url: loginUrl,
    }),
  });
  return updatedUser;
};

UserSchema.methods.comparePassword = function comparePassword(password) {
  if (!this.password) return false;
  return bcrypt.compareSync(password, this.password);
};

UserSchema.statics.findOneForApi = async function findOneForApi(query = {}) {
  const mailing = await this.findOne(query).populate({
    path: '_company',
    select:
      'id name issuer entryPoint enableCrmIntelligence enableEmailBuilder emailMetadata',
  });
  return mailing;
};

/// ///
// EXPORTS
/// ///

module.exports = UserSchema;
