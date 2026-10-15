'use strict';

// Shared by the tests of the checks the server runs (remote-rules.test.js,
// remote-review.test.js): an email of one text block, and the answer of the
// server as the editor reads it.

const { fakeViewModel, exportOf } = require('./fake-view-model');

const blocks = [{ id: 'b1', type: 'textBlock' }];

function vmWith(blockHtml) {
  return fakeViewModel({ blocks, html: exportOf({ b1: blockHtml }) });
}

const remoteOf = ({ links = {}, images = {}, blocklists } = {}) => ({
  links,
  images,
  blocklists: blocklists || { enabled: false, listed: {} },
});

module.exports = { blocks, vmWith, remoteOf };
