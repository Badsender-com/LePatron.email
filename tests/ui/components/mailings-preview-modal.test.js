'use strict';

// The preview modal renders previewHtml — the email's own markup, HTML code
// blocks included — in an iframe `srcDoc`. Without `sandbox`, that document runs
// in the app's origin. The server sanitizes the preview too, but the sandbox is
// the layer that does not depend on the sanitizer catching everything.
//
// The project has no @vue/test-utils, so this reads the component source.

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/ui/routes/mailings/__partials/mailings-preview-modal.vue'
  ),
  'utf8'
);

describe('mailings preview modal', () => {
  const iframe = /<iframe[\s\S]*?\/>/.exec(source)[0];

  it('sandboxes the preview iframe', () => {
    expect(iframe).toMatch(/\ssandbox="[^"]*"/);
  });

  it('never lets the preview run scripts', () => {
    expect(iframe).not.toMatch(/allow-scripts/);
  });
});
