'use strict';

const express = require('express');
const asyncHandler = require('express-async-handler');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');
const { isSigned } = require('./mcp-relayed-image-address.js');
const { relayedImage } = require('./mcp-relayed-image-fetch.js');

const ONE_DAY = 86400;
// Wide: a preview shows a few dozen images, and a viewer opens several. It
// keeps one address from making the instance fetch without end.
const RELAYED_IMAGES_PER_MINUTE = 600;
const MINUTE = 60 * 1000;

// Public: the frame of an assistant's preview has no LePatron session. The
// signature makes an address valid, for one image only (ADR 0022). Any
// refusal answers no image, and never says why.
const router = express.Router();

router.use(
  createRateLimiter({
    windowMs: MINUTE,
    max: RELAYED_IMAGES_PER_MINUTE,
    keyOf: clientIp,
  })
);

router.get(
  '/:signature',
  asyncHandler(async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    const image =
      url && isSigned(url, req.params.signature)
        ? await relayedImage(url)
        : null;
    if (!image) {
      res.status(404).end();
      return;
    }
    res.set({
      'Content-Type': image.type,
      'Cache-Control': `public, max-age=${ONE_DAY}`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.status(200).send(image.bytes);
  })
);

module.exports = router;
module.exports.RELAYED_IMAGES_PER_MINUTE = RELAYED_IMAGES_PER_MINUTE;
