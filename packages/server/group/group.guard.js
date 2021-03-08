const createError = require('http-errors');

// This Guard only works on routes that contain groupId if the user is not a super admin
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

    // Check if user group contain id else data is not valid
    if (group?.id !== groupId) {
      next(new createError.Unauthorized());
    }

    next();
  };
};

// This Guard ois to check the user.group.id property is defined
const guardUserHaveGroupId = () => {
  return (req, res, next) => {
    const { user } = req;
    if (!user) {
      return next(new createError.Unauthorized());
    }
    const { group } = user;

    // Check if user group contain id else data is not valid
    if (!group?.id) {
      next(new createError.Unauthorized());
    }

    next();
  };
};

module.exports = {
  GUARD_CAN_ACCESS_GROUP: guardCanAccessGroup(),
  GUARD_USER_HAVE_GROUP_ID: guardUserHaveGroupId(),
};
