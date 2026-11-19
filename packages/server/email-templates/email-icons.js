'use strict';

// The icons of the emails the platform sends, one PNG each in
// public/media/email (`icon-<name>.png`). The template draws them, and
// scripts/build-email-images.js builds them from the lucide icons of the
// application: both read this list.
const ICONS = [
  // The card of each email: lock for a password, shield for the second
  // factor, mail for the code, smartphone for a device.
  'lock',
  'shield-check',
  'shield-alert',
  'mail-check',
  'smartphone',
  // The three reasons of the welcome: blocks, a check, languages.
  'blocks',
  'badge-check',
  'languages',
];

module.exports = { ICONS };
