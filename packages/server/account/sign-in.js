'use strict';

const randToken = require('rand-token');

const { Users } = require('../common/models.common.js');
const permissions = require('./permissions.js');
const { isBootstrapAccount } = require('./bootstrap-account.js');
const { updateSessionTracking } = require('./session-tracking.helper.js');
const {
  resolveSelectedGroup,
  forgetSessionSelection,
} = require('./selected-group.js');

const promisify = (run) =>
  new Promise((resolve, reject) =>
    run((error) => (error ? reject(error) : resolve()))
  );

/**
 * Opens the session of `user` and answers the account as every later
 * request does: with its capabilities and its selected group (ADR 0002,
 * amended), so the screens the sign-in opens show what the user may do
 * without a reload. The last step of every sign-in, with or without a
 * second factor (ADR 0008).
 *
 * @param {Object} req
 * @param {Object} user the account, or the bootstrap account
 * @returns {Promise<Object>} the answer
 */
async function completeSignIn(req, user) {
  // A choice kept in the session belongs to the previous sign-in.
  forgetSessionSelection(req);
  await promisify((done) => req.logIn(user, done));
  await updateSessionTracking(req, user);

  // The bootstrap account has no document: it is returned as is. Any stored
  // user, super admin included, is reloaded with its populated group.
  const complete = isBootstrapAccount(user)
    ? user
    : await Users.findOneForApi({ _id: user._id });
  const payload = permissions.withCapabilities(
    complete.toJSON ? complete.toJSON() : { ...complete }
  );
  payload.selectedGroup = await resolveSelectedGroup(payload, req.session);

  // Saved before the answer: the next request must find the session.
  await promisify((done) => req.session.save(done));
  return payload;
}

/**
 * Ends every session of the account: none carries the new id, so the
 * session validation closes them on their next request.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function endSessions(userId) {
  await Users.updateOne(
    { _id: userId },
    { $set: { activeSessionId: randToken.generate(30) } }
  );
}

module.exports = { completeSignIn, endSessions };
