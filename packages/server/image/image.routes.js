'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER, GUARD_CAN } = require('../account/auth.guard.js');
const { CAPABILITIES: C } = require('../../shared/access/roles.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { isObjectIdString } = require('../utils/model.js');
const images = require('./image.controller.js');
const gallery = require('./gallery.controller.js');

// A gallery is keyed by its mailing's or template's id. Anything else reached
// the Mongoose casts and came back as a server error; it is a bad request,
// refused here before any controller reads it.
router.param('mongoId', (req, res, next, mongoId) => {
  if (!isObjectIdString(mongoId)) {
    return next(new createError.BadRequest(ERROR_CODES.INVALID_OBJECT_ID));
  }
  return next();
});

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
router.get('/gallery/:mongoId', gallery.list);
router.post('/gallery/:mongoId', GUARD_CAN(C.GALLERY_MANAGE), gallery.create);
router.post(
  '/gallery/:mongoId/from-url',
  GUARD_CAN(C.GALLERY_MANAGE),
  gallery.createFromUrl
);
router.patch(
  '/gallery/:mongoId/:imageName/label',
  GUARD_CAN(C.GALLERY_MANAGE),
  gallery.updateLabel
);
router.get('/:imageName', images.read);
router.delete('/:imageName', GUARD_CAN(C.GALLERY_MANAGE), images.destroy);

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
