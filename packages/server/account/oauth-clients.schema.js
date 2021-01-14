'use strict'

const { Schema } = require('mongoose')

// { id: '1', name: 'Samplr', clientId: 'abc123', clientSecret: 'ssh-secret', isTrusted: false },
// { id: '2', name: 'Samplr2', clientId: 'xyz123', clientSecret: 'ssh-password', isTrusted: true },

const OAuthClientsSchema = new Schema({
  name: { type: String },
  clientId: { type: String },
  clientSecret: { type: String },
  isTrusted: { type: Boolean },
})

OAuthClientsSchema.static.findByClientId = function findByClientId(clientId) {
  return this.findOne({ clientId })
}

module.exports = OAuthClientsSchema
