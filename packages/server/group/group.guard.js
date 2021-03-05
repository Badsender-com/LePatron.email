const createError = require('http-errors');

const guardCanAccessGroup = () => {
  return (req, res, next) => {
    const { user } = req;
    const { groupId } = req.params;
    if (user?._company?.id && groupId && groupId !== user?._company?.id) {
      next(new createError.Unauthorized());
    }
    next();
  };
};

module.exports = {
  GUARD_CAN_ACCESS_GROUP: guardCanAccessGroup,
};
