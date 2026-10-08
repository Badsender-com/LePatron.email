'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const images = require('./image.controller.js');

router.get(
  '/placeholder/:placeholderSize',
  images.checkImageCache,
  images.placeholder
);
router.get(
  '/resize/:sizes/:imageName',
  images.checkImageCache,
  images.checkSizes,
  images.resize
);
router.get(
  '/cover/:sizes/:imageName',
  images.checkImageCache,
  images.checkSizes,
  images.cover
);
router.all('/gallery*', GUARD_USER);
router.get('/gallery/:mongoId', images.list);
router.post('/gallery/:mongoId', images.create);
router.post('/gallery/:mongoId/from-url', images.createFromUrl);
router.patch('/gallery/:mongoId/:imageName/label', images.updateLabel);
router.get('/:imageName', images.read);
router.delete('/:imageName', GUARD_USER, images.destroy);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

// An <img> that receives an uncacheable error is re-requested on every
// re-render of the editor: that is how a single tab produced 37 req/s of 300 KB
// responses in production. Let the browser remember the failure for a minute so
// a broken image can never turn into a flood again.
const ERROR_CACHE_SECONDS = 60;

router.use((err, req, res, next) => {
  if (!res.headersSent) {
    res.set('Cache-Control', `public, max-age=${ERROR_CACHE_SECONDS}`);
  }
  next(err);
});

module.exports = router;
