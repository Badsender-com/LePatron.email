'use strict'

const { Schema } = require('mongoose')

// code,
// client.id,
// redirectUri,
// user.id,
// user.username,

const OAuthClientsCode = new Schema({
  // code: { type: String },
  clientId: { type: String },
  redirectUri: { type: String },
  userId: { type: String },
  userEmail: { type: String },
})

OAuthClientsCode.static.findByClientId = function findByClientId(clientId) {
  return this.findOne({ clientId })
}

module.exports = OAuthClientsCode
