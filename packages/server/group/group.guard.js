const createError = require('http-errors');

const guardCanAccessGroup = () => {
  return (req, res, next) => {
    const { user } = req;
    if (!user) {
      return next(new createError.Unauthorized());
    }

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

module.exports = {
  GUARD_CAN_ACCESS_GROUP: guardCanAccessGroup(),
};
