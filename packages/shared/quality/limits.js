'use strict';

// Bounds that the editor and the server must agree on. The editor trims what
// it sends to them, the server refuses what goes past them: two copies would
// drift, and a refused request fails the whole run.

// What the editor sends to POST /api/mailings/:mailingId/quality/resources.
const RESOURCES = Object.freeze({
  maxLinks: 60,
  maxImages: 40,
  maxUrlLength: 2048,
});

// The lifetimes a share link can be given, in days.
const SHARE_LINK_EXPIRY = Object.freeze({
  days: Object.freeze([1, 7, 30]),
  defaultDays: 7,
});

// Gmail clips any email whose HTML is over 102 KB: what follows, the footer
// and the open tracking pixel, hides behind "Message clipped". The editor's
// email weight rule warns of it, and the settings page when a company sets
// its weight threshold above it.
const GMAIL_CLIPPING_BYTES = 102 * 1024;

module.exports = { RESOURCES, SHARE_LINK_EXPIRY, GMAIL_CLIPPING_BYTES };
