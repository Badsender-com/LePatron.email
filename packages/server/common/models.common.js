'use strict'

const mongoose = require('mongoose')

mongoose.Promise = global.Promise // Use native promises

const UserSchema = require('../user/user.schema.js')
const TemplateSchema = require('../template/template.schema.js')
const MailingSchema = require('../mailing/mailing.schema.js')
const GroupSchema = require('../group/group.schema.js')
const CacheImageSchema = require('../image/image-cache.schema.js')
const GallerySchema = require('../image/gallery.schema.js')
const OAuthClientsSchema = require('../account/oauth-clients.schema.js')
const OAuthTokensSchema = require('../account/oauth-tokens.schema.js')
const OAuthCodesSchema = require('../account/oauth-codes.schema.js')

const modelNames = require('../constant/model.names.js')

//////
// EXPORTS
//////

const Users = mongoose.model(modelNames.UserModel, UserSchema)
const Templates = mongoose.model(modelNames.TemplateModel, TemplateSchema)
const Mailings = mongoose.model(modelNames.MailingModel, MailingSchema)
const Groups = mongoose.model(modelNames.GroupModel, GroupSchema)
const CacheImages = mongoose.model(modelNames.CacheImageModel, CacheImageSchema)
const Galleries = mongoose.model(modelNames.GalleryModel, GallerySchema)
const OAuthTokens = mongoose.model(modelNames.OAuthTokens, OAuthTokensSchema)
const OAuthClients = mongoose.model(modelNames.OAuthClients, OAuthClientsSchema)
const OAuthCodes = mongoose.model(modelNames.OAuthCodes, OAuthCodesSchema)

module.exports = {
  mongoose,
  // Compiled schema
  Users,
  Templates,
  Mailings,
  Groups,
  CacheImages,
  Galleries,
  OAuthTokens,
  OAuthClients,
  OAuthCodes,
}
