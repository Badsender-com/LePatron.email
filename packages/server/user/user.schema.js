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
const mail = require('../mailing/mail.service.js');
const Roles = require('../account/roles');
const { normalizeString } = require('../utils/model');
const { GroupModel } = require('../constant/model.names.js');

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
      enum: [Roles.GROUP_ADMIN, Roles.REGULAR_USER],
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
    activeSessionId: {
      type: String,
      default: null,
      select: false, // Hidden by default, must be explicitly selected
    },
    sessionCreatedAt: {
      type: Date,
      default: null,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    lastLoginUserAgent: {
      type: String,
      default: null,
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
  hidden: { _id: true, __v: true, password: true, token: true, activeSessionId: true },
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

UserSchema.virtual('isGroupAdmin').get(function () {
  const user = this;
  return user.role === Roles.GROUP_ADMIN;
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
    subject: `${config.emailOptions.passwordSubjectPrefix} – Password reset`,
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
        baseline: 'L\'EMAILING SUR MESURE',
        footerBaseline1: 'Pour des emails sur mesure',
        footerBaseline2: 'et modulables',
        rgpd1:
          'Conformément au règlement européen pour la protection des données personnelles (RGPD) et, en France, à la loi "informatique et libertés", vous bénéficiez notamment d\'un droit d\'accès, de rectification et de suppression des données personnelles vous concernant. Pour en savoir davantage sur tous vos droits et les conditions dans lesquelles Badsender traite vos données personnelles, nous vous invitons à prendre connaissance de',
        rgpd2:
          'Pour exercer vos droits ou pour toute question, nous vous remercions de nous contacter à l\'adresse suivante&nbsp;:',
        rgpdUrl: 'notre Politique de confidentialité',
        zeroCarbon:
          'N\'oubliez pas de détruire ce message une fois que vous l\'aurez consulté. Toutes nos bonnes pratiques pour un emailing + vert sont à disposition ',
        zeroCarbonLink: 'en suivant ce lien',
        legals: 'Badsender SASU - SIRET 81310812300015',
      },
      en: {
        baseline: 'TAILOR-MADE EMAILING',
        footerBaseline1: 'For tailor-made emails',
        footerBaseline2: 'and scalable',
        rgpd1:
          'In accordance with the European regulation for the protection of personal data (GDPR) and, in France, with the law "informatique et liberté", you have the right to access, rectify and delete your personal data. To learn more about all your rights and the conditions under which Badsender processes your personal data, we invite you to read',
        rgpd2:
          'To exercise your rights or if you have any questions, please contact us at the following address:',
        rgpdUrl: 'our Privacy Policy',
        zeroCarbon:
          'Don\'t forget to delete this message once you\'ve viewed it. All our best practices for a green emailing are available ',
        zeroCarbonLink: 'by following this link',
        legals: 'Badsender SASU - SIRET 81310812300015',
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
