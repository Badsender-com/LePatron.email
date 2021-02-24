'use strict';

const { Schema } = require('mongoose');

// const tokens = {}

// module.exports.find = (key, done) => {
//   if (tokens[key]) return done(null, tokens[key])
//   return done(new Error('Token Not Found'))
// }

// module.exports.findByUserIdAndClientId = (userId, clientId, done) => {
//   for (const token in tokens) {
//     if (tokens[token].userId === userId && tokens[token].clientId === clientId)
//       return done(null, token)
//   }
//   return done(new Error('Token Not Found'))
// }

// module.exports.save = (token, userId, clientId, done) => {
//   tokens[token] = { userId, clientId }
//   done()
// }

const OAuthTokensSchema = new Schema({
  // accessToken: { type: String },
  // accessTokenExpiresOn: { type: Date },
  // client: { type: Object }, // `client` and `user` are required in multiple places, for example `getAccessToken()`
  clientId: { type: String },
  // refreshToken: { type: String },
  // refreshTokenExpiresOn: { type: Date },
  // user: { type: Object },
  userId: { type: String },
});

OAuthTokensSchema.static.findByUserIdAndClientId = function findByUserIdAndClientId(
  userId,
  clientId
) {
  return this.findOne({ userId, clientId });
};

module.exports = OAuthTokensSchema;
