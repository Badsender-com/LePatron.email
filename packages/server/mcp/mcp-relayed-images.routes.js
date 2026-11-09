'use strict';

const express = require('express');
const asyncHandler = require('express-async-handler');
const { isSigned, fetchRelayedImage } = require('./mcp-relayed-images.js');

const ONE_DAY = 86400;

// Public: the frame of an assistant's preview has no LePatron session. The
// signature makes an address valid, for one image only (ADR 0022). Any
// refusal answers no image, and never says why.
const router = express.Router();

router.get(
  '/:signature',
  asyncHandler(async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    const image =
      url && isSigned(url, req.params.signature)
        ? await fetchRelayedImage(url)
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
