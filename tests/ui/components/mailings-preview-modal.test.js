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

  // Which message, for which failure, is tested on the helper itself
  // (tests/ui/helpers/preview-error.test.js); here, only that the modal uses it.
  it('picks its error message from the server error code', () => {
    expect(source).toMatch(/previewErrorMessages\(e, \{/);
    expect(source).toMatch(/\$t\(errorMessages\.title\)/);
    expect(source).toMatch(/\$t\(errorMessages\.subtitle\)/);
  });

  it.each(['en', 'fr'])('translates the preview error messages in %s', (l) => {
    const locale = fs.readFileSync(
      path.join(__dirname, `../../../packages/ui/helpers/locales/${l}.js`),
      'utf8'
    );
    expect(locale).toMatch(/previewUnavailable:/);
    expect(locale).toMatch(/subPreviewUnavailable:/);
    expect(locale).toMatch(/subErrorPreviewReadOnly:/);
  });
});
