'use strict';

const { assign } = require('lodash');
const fs = require('fs');
const path = require('path');
const { Schema } = require('mongoose');
const { ObjectId } = Schema.Types;
const tmpl = require('blueimp-tmpl');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const randToken = require('rand-token');
const moment = require('moment');
const mongooseHidden = require('mongoose-hidden')();

const config = require('../node.config.js');
const mail = require('../mailing/mailing.service.js');
const Roles = require('./role');
const { normalizeString } = require('../utils/model');
const { GroupModel } = require('../constant/model.names.js');

/**
 * @apiDefine users
 * @apiSuccess {String} id
 * @apiSuccess {String} name
 * @apiSuccess {Date} createdAt creation date
 * @apiSuccess {Date} updatedAt last update date
 * @apiSuccess {String} lang selected langue of the user
 * @apiSuccess {Boolean} isReinitialized wether the password has been reinitialized or not
 * @apiSuccess {Boolean} isDeactivated wether this account has been deactivated or not
 * @apiSuccess {Boolean} isAdmin wether this account has admin status
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
      enum: [Roles.GROUP_ADMIN, Roles.GROUP_USER],
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
    isDeactivated: { type: String, default: false },
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
  hidden: { _id: true, __v: true, password: true, token: true, _company: true },
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

// for better session handling
UserSchema.virtual('isAdmin').get(function () {
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
  user.isDeactivated = true;
  return user.save();
};

UserSchema.methods.resetPassword = async function resetPassword(type, lang) {
  const user = this;
  user.password = undefined;
  user.token = randToken.generate(30);
  user.tokenExpire = moment().add(1, 'weeks');
  lang = lang || 'en';

  const updatedUser = await user.save();
  const resetUrl = `http://${config.host}/account/${updatedUser.email}/password/${user.token}`;
  await mail.send({
    to: updatedUser.email,
    subject: `${config.emailOptions.passwordSubjectPrefix} – password reset`,
    text: `here is the link to enter your new password ${resetUrl}`,
    html: tmpReset(
      getTemplateData('reset-password', lang, {
        type: type,
        url: resetUrl,
      })
    ),
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
  const loginUrl = `http://${config.host}/account/login`;
  await mail.send({
    to: updatedUser.email,
    subject: `${config.emailOptions.passwordSubjectPrefix} – password reset`,
    text: `your password has been successfully been reinitialized. connect at ${loginUrl}`,
    html: tmpReset(
      getTemplateData('reset-success', lang, {
        type: 'admin',
        url: loginUrl,
      })
    ),
  });
  return updatedUser;
};

UserSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compareSync(password, this.password);
};

UserSchema.statics.findOneForApi = async function findOneForApi(query = {}) {
  const mailing = await this.findOne(query).populate({
    path: '_company',
    select: 'id name issuer entryPoint',
  });
  return mailing;
};

/// ///
// DEFINING mailing templates
/// ///

tmpl.load = function (id) {
  const filename = path.join(__dirname, `../email-templates/${id}.html`);
  return fs.readFileSync(filename, 'utf8');
};

// put in cache
const tmpReset = tmpl('reset-password');

function getTemplateData(templateName, lang, additionalDatas) {
  const i18n = {
    common: {
      fr: {
        contact: 'Contacter Badsender : ',
        or: 'ou',
        // social: `Badsender sur les réseaux sociaux :`,
        social: 'Badsender sur les r&eacute;seaux sociaux :',
      },
      en: {
        contact: 'contact Badsender: ',
        or: 'or',
        social: 'Badsender on social networks:',
      },
    },
    'reset-password': {
      fr: {
        title: 'Bienvenue sur l\'email builder de Badsender',
        desc:
          'Cliquez sur le bouton ci-dessous pour initialiser votre mot de passe, ou copiez l\'url suivante dans votre navigateur:',
        reset: 'INITIALISER MON MOT DE PASSE',
      },
      en: {
        title: 'Welcome to the Badsender\'s email builder',
        desc:
          'Click the button below to reset your password, or copy the following URL into your browser:',
        reset: 'RESET MY PASSWORD',
      },
    },
    'reset-success': {
      fr: {
        title: 'Votre mot de passe a bien été réinitialisé',
        desc:
          'Cliquez sur le bouton ci-dessous pour vous connecter, ou copiez l\'url suivante dans votre navigateur:',
        reset: 'SE CONNECTER',
      },
      en: {
        title: 'Your password has been successfully updated',
        desc:
          'Click the button below to login, or copy the following URL into your browser:',
        reset: 'LOGIN',
      },
    },
  };

  const traductions = assign({}, i18n.common[lang], i18n[templateName][lang]);
  return assign({}, { t: traductions }, additionalDatas);
}

/// ///
// EXPORTS
/// ///

module.exports = UserSchema;
