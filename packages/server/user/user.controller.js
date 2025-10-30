'use strict';

const pick = require('lodash').pick;
const createError = require('http-errors');
const asyncHandler = require('express-async-handler');
const passport = require('passport');
const Roles = require('../account/roles');

const { Users, Mailings, Groups } = require('../common/models.common.js');
const config = require('../node.config.js');
const userService = require('../user/user.service.js');
const groupService = require('../group/group.service.js');
const { ERROR_CODES } = require('../constant/error-codes.js');

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
  getCurrentUser: asyncHandler(getCurrentUser),
};

/**
 * @api {get} /users/current-user Current user
 * @apiPermission all users
 * @apiName GetCurrentUser
 * @apiGroup Users
 *
 * @apiUse users
 */
async function getCurrentUser(req, res, next) {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      return next(new createError.NotFound(ERROR_CODES.USER_NOT_FOUND));
    }

    return res.status(200).json(currentUser);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    return res.status(500).send();
  }
}

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
  const { user: connectedUser } = req;
  const users = await userService.findByGroupId(connectedUser?.group?.id);
  res.json(users);
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
 * @apiParam (Body) {String} externalUsername
 * @apiParam (Body) {String} [lang="en"]
 *
 * @apiUse users
 */

async function create(req, res) {
  const { groupId } = req.body;
  if (!groupId) {
    throw new createError.BadRequestError(
      'user.controller : in create, no groupId provided in request'
    );
  }
  await groupService.findById(groupId);

  const userParams = pick(req.body, [
    'name',
    'email',
    'lang',
    'externalUsername',
  ]);
  const role =
    req.body.role === Roles.GROUP_ADMIN
      ? Roles.GROUP_ADMIN
      : Roles.REGULAR_USER;

  const newUser = await userService.createUser({
    groupId,
    role,
    ...userParams,
  });
  res.json(newUser);
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
 * @apiParam {number} [page=1]
 * @apiParam {number} [limit=10]
 *
 * @apiUse mailings
 * @apiSuccess {mailings[]} items
 */
async function readMailings(req, res) {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);
  const offset = (parsedPage - 1) * parsedLimit;

  const user = await Users.findById(userId).select('_id');
  if (!user) {
    throw new createError.NotFound(); // Ensure this error is properly handled by your error middleware
  }

  // Retrieve mailings and their total count
  const [mailings, totalItems] = await Promise.all([
    Mailings.find({ _user: userId })
      .select('-previewHtml -data')
      .skip(offset)
      .limit(parsedLimit),
    Mailings.countDocuments({ _user: userId }), // Count all mailings for this user
  ]);

  res.json({
    items: mailings,
    totalItems,
    currentPage: parsedPage,
    totalPages: Math.ceil(totalItems / parsedLimit), // Calculate the total number of pages
  });
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
 * @apiParam (Body) {String} externalUsername
 * @apiParam (Body) {String} [lang="en"]
 *
 * @apiUse users
 */

async function update(req, res) {
  const { userId } = req.params;
  if (!userId) {
    throw new createError.BadRequestError(
      'user.controller :  in update function, no userId provided in request'
    );
  }

  const userParams = pick(req.body, [
    'name',
    'email',
    'lang',
    'role',
    'externalUsername',
  ]);
  const updatedUser = await userService.updateUser({ userId, ...userParams });

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
  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      return next(new createError.InternalServerError(err));
    }

    if (info && info.message) {
      return next(new createError.BadRequest(info.message));
    }

    if (!user) {
      return next(new createError.BadRequest('User not found'));
    }

    req.logIn(user, async (err) => {
      if (err) {
        return next(new createError.InternalServerError(err));
      }

      // Update session using helper function
      const { updateUserSession } = require('../account/session-update.helper.js');
      await updateUserSession(req, user.id);

      return res.json({ isAdmin: user.isAdmin });
    });
  })(req, res);
}
