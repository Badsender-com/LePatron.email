'use strict';

const _ = require('lodash');
const createError = require('http-errors');
const asyncHandler = require('express-async-handler');
const passport = require('passport');

const { Users, Mailings, Groups } = require('../common/models.common.js');
const config = require('../node.config.js');

module.exports = {
  list: asyncHandler(list),
  getByGroupId: asyncHandler(getUsersByGroupId),
  create: asyncHandler(create),
  read: asyncHandler(read),
  readMailings: asyncHandler(readMailings),
  update: asyncHandler(update),
  activate: asyncHandler(activate),
  deactivate: asyncHandler(deactivate),
  adminResetPassword: asyncHandler(adminResetPassword),
  forgotPassword: asyncHandler(forgotPassword),
  setPassword: asyncHandler(setPassword),
  getPublicProfile: asyncHandler(getPublicProfile),
  login: asyncHandler(login),
};

/**
 * @api {get} /users list of users
 * @apiPermission admin
 * @apiName GetUsers
 * @apiGroup Users
 *
 * @apiUse users
 * @apiSuccess {users[]} items list of users
 */

async function list(req, res) {
  const users = await Users.find({})
    .populate({ path: '_company', select: 'id name entryPoint issuer' })
    .sort({ isDeactivated: 1, createdAt: -1 });
  res.json({ items: users });
}

async function getUsersByGroupId(req, res) {
  const { groupId } = req.params;
  const users = await Users.where('_company.id').equals(groupId);
  console.log({users})
  res.json({users});
}

/**
 * @api {post} /users user creation
 * @apiPermission admin
 * @apiName CreateUser
 * @apiGroup Users
 *
 * @apiParam (Body) {String} groupId the group of the user
 * @apiParam (Body) {String} email should be unique in the application
 * @apiParam (Body) {String} [name]
 * @apiParam (Body) {String} [lang="en"]
 *
 * @apiUse users
 */

async function create(req, res) {
  const { groupId } = req.body;
  const group = await Groups.findById(groupId).select('_id').lean();
  if (!group) throw new createError.BadRequest('group not found');

  const userParams = _.pick(req.body, ['name', 'email', 'lang']);
  const newUser = await Users.create({
    _company: groupId,
    ...userParams,
  });
  const user = await Users.findOneForApi({ _id: newUser._id });
  res.json(user);
}

/**
 * @api {get} /users/:userId user
 * @apiPermission admin
 * @apiName GetUser
 * @apiGroup Users
 *
 * @apiParam {string} userId
 *
 * @apiUse users
 */

async function read(req, res) {
  const { userId } = req.params;
  const user = await Users.findOneForApi({ _id: userId });
  if (!user) throw new createError.NotFound();

  res.json(user);
}

/**
 * @api {get} /users/:userId/mailings user mailings
 * @apiPermission admin
 * @apiName GetUserMailings
 * @apiGroup Users
 *
 * @apiParam {string} userId
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items
 */

async function readMailings(req, res) {
  const { userId } = req.params;
  const [user, mailings] = await Promise.all([
    Users.findById(userId).select({ _id: 1 }),
    Mailings.findForApi({ _user: userId }),
  ]);
  if (!user) throw new createError.NotFound();

  res.json({ items: mailings });
}

/**
 * @api {put} /users/:userId user update
 * @apiPermission admin
 * @apiName UpdateUser
 * @apiGroup Users
 *
 * @apiParam {string} userId
 * @apiParam (Body) {String} email should be unique in the application
 * @apiParam (Body) {String} name
 * @apiParam (Body) {String} [lang="en"]
 *
 * @apiUse users
 */

async function update(req, res) {
  const { userId } = req.params;
  const userParams = _.pick(req.body, ['name', 'email', 'lang']);
  const user = await Users.findOneForApi({ _id: userId });
  if (!user) throw new createError.NotFound();

  // we don't need for this DB request to finish to give the user the response
  const nameChange = user.name !== userParams.name;
  if (nameChange) {
    Mailings.updateMany({ _user: userId }, { author: userParams.name }).then(
      (result) => {
        console.log(result.nModified, 'mailings updated for', userParams.name);
      }
    );
  }
  const updatedUser = await Users.findByIdAndUpdate(userId, userParams, {
    runValidators: true,
  }).populate({
    path: '_company',
    select: 'id name',
  });
  res.json(updatedUser);
}

/**
 * @api {put} /users/:userId/activate user activation
 * @apiPermission admin
 * @apiName ActivateUser
 * @apiDescription Activate a user
 * @apiGroup Users
 *
 * @apiParam {string} userId
 *
 * @apiUse users
 */

async function activate(req, res) {
  const { userId } = req.params;
  const user = await Users.findById(userId);
  if (!user) throw new createError.NotFound();

  await user.activate();
  const updatedUser = await Users.findOneForApi({ _id: userId });
  res.json(updatedUser);
}

/**
 * @api {del} /users/:userId user deactivation
 * @apiPermission admin
 * @apiName DeactivateUser
 * @apiDescription A user can't be deleted (or else all the mailings would disappear).<br> But an account can disabled
 * @apiGroup Users
 *
 * @apiParam {string} userId
 *
 * @apiUse users
 */

async function deactivate(req, res) {
  const { userId } = req.params;
  const user = await Users.findById(userId);
  if (!user) throw new createError.NotFound();

  await user.deactivate();
  const updatedUser = await Users.findOneForApi({ _id: userId });
  res.json(updatedUser);
}

/**
 * @api {del} /users/:userId/password user password reset
 * @apiPermission admin
 * @apiName ResetPasswordUser
 * @apiDescription This will force-reset any password the user could have set and send a new set-password mail
 * @apiGroup Users
 *
 * @apiParam {string} userId
 *
 * @apiUse users
 */

async function adminResetPassword(req, res) {
  const { userId } = req.params;
  const user = await Users.findById(userId);
  if (!user) throw new createError.NotFound();

  await user.resetPassword('admin', user.lang);
  const updatedUser = await Users.findOneForApi({ _id: userId });
  res.json(updatedUser);
}

/**
 * @api {del} /account/:email/password user password forgot
 * @apiPermission public
 * @apiName ResetPasswordUser
 * @apiDescription This will set a new password password
 * @apiGroup Account
 *
 * @apiParam {string} email user's email
 *
 * @apiUse users
 */

async function forgotPassword(req, res) {
  const { email } = req.params;
  const user = await Users.findOne({ email });
  if (!user) throw new createError.BadRequest();

  await user.resetPassword('user', user.lang);
  const updatedUser = await Users.findOneForApi({ _id: user._id });
  res.json(updatedUser);
}

/**
 * @api {put} /account/:email/password/:token user password set
 * @apiPermission public
 * @apiName SetPasswordUser
 * @apiDescription This will set a new password password
 * @apiGroup Account
 *
 * @apiParam {string} email user's email
 * @apiParam {string} token the token sent by mail
 *
 * @apiParam (Body) {String} password
 * @apiParam (Body) {Boolean} passwordConfirm
 *
 * @apiUse users
 */

async function setPassword(req, res) {
  const { token } = req.params;
  const user = await Users.findOne({
    token,
    tokenExpire: { $gt: Date.now() },
  });
  if (!user) throw new createError.BadRequest('invalid or expired token');

  const isValidPassword = req.body.password === req.body.passwordConfirm;
  if (!isValidPassword) {
    throw new createError.BadRequest('passwords should be identical');
  }

  await user.setPassword(req.body.password, user.lang);
  await new Promise((resolve, reject) => {
    req.login(user, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
  const updatedUser = await Users.findOneForApi({ _id: user._id });
  res.json(updatedUser);
}

async function getPublicProfile(req, res) {
  const { username } = req.params;

  if (username === config.admin.username) {
    // TODO rework this
    return res.json({ group: { isSAMLAuthentication: false } });
  }
  // todo move on service
  const user = await Users.findOne({
    email: username,
    isDeactivated: { $ne: true },
  });
  if (!user) throw new createError.BadRequest('User not found');
  const group = await Groups.findOne({
    _id: user.group,
  });

  const { name, email, isDeactivated } = user;
  const { name: groupName, entryPoint, issuer } = group;

  return res.json({
    name,
    email,
    isDeactivated,
    group: { name: groupName, isSAMLAuthentication: entryPoint && issuer },
  });
}

async function login(req, res, next) {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(new createError.InternalServerError(err));
    }

    if (info && info.message) {
      return next(new createError.BadRequest(info.message));
    }

    if (!user) return next(new createError.BadRequest('User not found'));

    req.logIn(user, (err) => {
      if (err) {
        return next(new createError.InternalServerError(err));
      }

      return res.json({ isAdmin: user.isAdmin });
    });
  })(req, res);
}
