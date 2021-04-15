'use strict';

const asyncHandler = require('express-async-handler');
const { NotFound } = require('http-errors');

const config = require('../node.config.js');
const simpleI18n = require('../helpers/server-simple-i18n.js');
const brandColors = require('../helpers/brand-colors.js');
const modelsUtils = require('../utils/model.js');
const mailingService = require('../mailing/mailing.service.js');
const workspaceService = require('../workspace/workspace.service.js');
const folderService = require('../folder/folder.service.js');
const { Mailings } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');

module.exports = {
  exposeHelpersToPug: exposeHelpersToPug,
  render: asyncHandler(render),
};

function exposeHelpersToPug(req, res, next) {
  res.locals.getLocale = function getLocale() {
    return req.user.lang;
  };
  res.locals.__ = (key) => simpleI18n(key, req.user.lang);
  res.locals._config = {
    isDev: config.isDev,
    host: config.host,
  };
  res.locals.printJS = function (data) {
    return JSON.stringify(data, null, '  ');
  };
  next();
}

async function render(req, res) {
  const {
    params: { mailingId },
    user,
  } = req;

  const mailing = await mailingService.findOne(mailingId);

  const { _workspace, _parentFolder } = mailing;

  let hasAccess;

  if (_parentFolder) {
    hasAccess = await folderService.hasAccess(_parentFolder, user);
  }

  if (_workspace) {
    hasAccess = await workspaceService.hasAccess(user, _workspace);
  }

  if (!hasAccess) {
    res.redirect('/404');
    throw new NotFound(ERROR_CODES.MAILING_NOT_FOUND);
  }

  const query = modelsUtils.addGroupFilter(req.user, { _id: mailingId });
  const mailingForMosaico = await Mailings.findOneForMosaico(
    query,
    user.lang
  );
  if (!mailingForMosaico) return res.redirect('/404');

  res.render('mosaico-editor', {
    data: mailingForMosaico,
    // pass all theme as css custom properties
    themeColors: brandColors.asCssCustomProperties(),
  });
}
