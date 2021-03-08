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
};
