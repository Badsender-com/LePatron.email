'use strict'

const util = require('util')
const mongoose = require('mongoose')

mongoose.Promise = global.Promise // Use native promises

const UserSchema = require('../models/schema-user.js')
const TemplateSchema = require('../models/schema-template.js')
const MailingSchema = require('../models/schema-mailing.js')
const GroupSchema = require('../models/schema-group.js')
const CacheImageSchema = require('../models/schema-cache-image.js')
const GallerySchema = require('../models/schema-gallery.js')
const OAuthClientsSchema = require('../models/schema-oauth-clients.js')
const OAuthTokensSchema = require('../models/schema-oauth-tokens.js')
const OAuthCodesSchema = require('../models/schema-oauth-codes.js')

const modelNames = require('../models/names.js')

//////
// ERRORS HANDLING
//////

// normalize errors between mongoose & mongoDB
function handleValidationErrors(err) {
  console.log('handleValidationErrors')
  console.log(util.inspect(err))
  // mongoose errors
  if (err.name === 'ValidationError') {
    return Promise.resolve(err.errors)
  }
  // duplicated field
  if (err.name === 'MongoError' && err.code === 11000) {
    // mongo doens't provide field name out of the box
    // fix that based on the error message
    var fieldName = /index:\s([a-z]*)/.exec(err.message)[1]
    var errorMsg = {}
    errorMsg[fieldName] = {
      message: `this ${fieldName} is already taken`,
    }
    return Promise.resolve(errorMsg)
  }
  return Promise.reject(err)
}

// take care of everything
function formatErrors(err, req, res, next) {
  handleValidationErrors(err)
    .then(errorMessages => {
      req.flash('error', errorMessages)
      res.redirect(req.path)
    })
    .catch(next)
}

//////
// HELPERS
//////

function isFromCompany(user, companyId) {
  if (!user) return false
  if (user.isAdmin) return true
  // creations from admin doesn't gave a companyId
  if (!companyId) return false
  return String(user._company) === String(companyId)
}

// users can access only same group content
// admin everything
function addGroupFilter(user, filter) {
  if (user.isAdmin) return filter
  filter._company = user._company
  return filter
}

// Strict difference from above:
// Admin can't see content with a company
function addStrictGroupFilter(user, filter) {
  const _company = user.isAdmin ? { $exists: false } : user._company
  filter._company = _company
  return filter
}

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
  formatErrors,
  isFromCompany,
  addGroupFilter,
  addStrictGroupFilter,
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
