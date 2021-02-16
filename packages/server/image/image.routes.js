'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const images = require('./image.controller.js');

router.get(
  `/placeholder/:placeholderSize`,
  images.checkImageCache,
  images.placeholder
);
router.get(
  `/resize/:sizes/:imageName`,
  images.checkImageCache,
  images.checkSizes,
  images.resize
);
router.get(
  `/cover/:sizes/:imageName`,
  images.checkImageCache,
  images.checkSizes,
  images.cover
);
router.all(`/gallery*`, GUARD_USER);
router.get(`/gallery/:mongoId`, images.list);
router.post(`/gallery/:mongoId`, images.create);
router.get(`/:imageName`, images.read);
router.delete(`/:imageName`, GUARD_USER, images.destroy);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
