'use strict';
const asyncHandler = require('express-async-handler');

// const config = require('../node.config.js');
// const simpleI18n = require('../helpers/server-simple-i18n.js');

module.exports = {
  // exposeHelpersToPug: exposeHelpersToPug,
  render: asyncHandler(render),
};

// function exposeHelpersToPug(req, res, next) {
//   res.locals.getLocale = function getLocale() {
//     return req.user.lang;
//   };
//   res.locals.__ = (key) => simpleI18n(key, req.user.lang);
//   res.locals._config = {
//     isDev: config.isDev,
//     host: config.host,
//   };
//   res.locals.printJS = function (data) {
//     return JSON.stringify(data, null, '  ');
//   };
//   next();
// }

async function render(req, res) {
  res.render('maintenance-page');
}
