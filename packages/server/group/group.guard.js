const createError = require('http-errors');

const guardCanAccessGroup = () => {
  return (req, res, next) => {
    const { user } = req;
    if (!user) {
      return next(new createError.Unauthorized());
    }

    // We bypass the check if the user is a super admin
    if (user.isAdmin) {
      return next();
    }
    const { groupId } = req.params;
    const { group } = user;
    if (group.id === groupId) {
      return next();
    }
    next(new createError.Unauthorized());
  };
};

const guardCanAccessGroupFromBody = () => {
  return (req, res, next) => {
    const { user } = req;
    if (!user) {
      return next(new createError.Unauthorized());
    }

    // We bypass the check if the user is a super admin
    if (user.isAdmin) {
      return next();
    }
    const { groupId } = req.body; // Get groupId from the request body
    const { group } = user;

    if (group.id === groupId) {
      return next();
    }
    next(new createError.Unauthorized());
  };
};

const guardCanAccessGroupFromQuery = () => {
  return (req, res, next) => {
    const { user } = req;
    if (!user) {
      return next(new createError.Unauthorized());
    }

    // We bypass the check if the user is a super admin
    if (user.isAdmin) {
      return next();
    }
    const { groupId } = req.query; // Get groupId from the request query
    const { group } = user;

    if (group.id === groupId) {
      return next();
    }
    next(new createError.Unauthorized());
  };
};

module.exports = {
  GUARD_CAN_ACCESS_GROUP: guardCanAccessGroup(),
  GUARD_CAN_ACCESS_GROUP_FROM_BODY: guardCanAccessGroupFromBody(),
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY: guardCanAccessGroupFromQuery(),
};
