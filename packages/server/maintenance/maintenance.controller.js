'use strict';

const asyncHandler = require('express-async-handler');

module.exports = {
  render: asyncHandler(render),
};

async function render(req, res) {
  res.render('maintenance-pages/maintenance-page');
}
