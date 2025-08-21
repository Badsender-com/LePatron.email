'use strict';

const { Users, Logs } = require('../common/models.common.js');

async function createLog(log, userId) {
  const user = await Users.findOneForApi({ _id: userId });

  const newLog = {
    ...log,
    _user: user,
  };

  return Logs.create(newLog);
}

module.exports = {
  createLog,
};
