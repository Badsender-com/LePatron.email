'use strict';

const asyncHandler = require('express-async-handler');

const config = require('../node.config.js');
const simpleI18n = require('../helpers/server-simple-i18n.js');
const brandColors = require('../helpers/brand-colors.js');
const modelsUtils = require('../utils/model.js');
const { Mailings } = require('../common/models.common.js');

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
  // Serialised into a `<script>` block through Pug's UNESCAPED interpolation
  // (`!{ printJS(data) }` in mosaico-editor.pug). JSON.stringify does not escape
  // `/`, so any string in the payload containing `</script>` closes the tag and
  // executes what follows on the application origin.
  //
  // The payload has always carried user-controlled strings (the email name, the
  // whole template `data`); this escaping closes the sink for all of them at
  // once. Escaping `<` and `>` as unicode sequences is inert inside a JS string
  // literal and cannot break the parse; U+2028/U+2029 are line terminators in
  // JS but not in JSON.
  res.locals.printJS = function (data) {
    return JSON.stringify(data, null, '  ')
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  };
  next();
}

async function render(req, res) {
  const {
    params: { mailingId },
    user,
  } = req;

  const query = modelsUtils.addGroupFilter(req.user, { _id: mailingId });
  const mailingForMosaico = await Mailings.findOneForMosaico(
    user,
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
