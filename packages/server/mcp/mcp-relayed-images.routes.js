'use strict';

const express = require('express');
const asyncHandler = require('express-async-handler');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');
const { isSigned } = require('./mcp-relayed-image-address.js');
const {
  relayedImage,
  cachedRelayedImage,
} = require('./mcp-relayed-image-fetch.js');

const ONE_DAY = 86400;
// Short: an image the host serves again soon shows again soon.
const NO_IMAGE_SECONDS = 60;
// Wide: a preview shows a few dozen images, and a viewer opens several. It
// keeps one address from making the instance fetch without end.
const RELAYED_IMAGES_PER_MINUTE = 600;
const MINUTE = 60 * 1000;

// Public: the frame of an assistant's preview has no LePatron session. The
// signature makes an address valid, for one image only (ADR 0022). Any
// refusal answers no image, and never says why.
const router = express.Router();

// An answer of this route is an image or nothing: opened on its own, it runs
// nothing and loads nothing.
router.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  });
  next();
});

router.use(
  createRateLimiter({
    windowMs: MINUTE,
    max: RELAYED_IMAGES_PER_MINUTE,
    keyOf: clientIp,
  })
);

const signedUrlOf = (req) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  return url && isSigned(url, req.params.signature) ? url : null;
};

function answer(res, image, { withBody }) {
  if (!image) {
    res.set('Cache-Control', `public, max-age=${NO_IMAGE_SECONDS}`);
    res.status(404).end();
    return;
  }
  res.set({
    'Content-Type': image.type,
    'Content-Length': String(image.bytes.length),
    'Cache-Control': `public, max-age=${ONE_DAY}`,
  });
  if (withBody) res.status(200).send(image.bytes);
  else res.status(200).end();
}

// Never a fetch: what the instance holds already, or no image.
router.head('/:signature', (req, res) => {
  const url = signedUrlOf(req);
  answer(res, url && cachedRelayedImage(url), { withBody: false });
});

router.get(
  '/:signature',
  asyncHandler(async (req, res) => {
    const url = signedUrlOf(req);
    answer(res, url && (await relayedImage(url)), { withBody: true });
  })
);

module.exports = router;
module.exports.RELAYED_IMAGES_PER_MINUTE = RELAYED_IMAGES_PER_MINUTE;
