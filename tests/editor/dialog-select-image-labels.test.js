'use strict';

// The image picker's two tabs each speak of their own gallery.
//
// The "template" tab said "La galerie de l'email est vide" while loading and
// when empty: it reused the email tab's keys. The block builder opens this
// dialog for its images, which is where it was seen.

const fs = require('fs');
const path = require('path');

const markup = fs.readFileSync(
  path.join(
    __dirname,
    '../../packages/editor/src/tmpl-badsender/dialog-select-image.tmpl.html'
  ),
  'utf8'
);

const TEMPLATE_TAB = '<div id="dialoggallerytemplate"';
const [emailTab, templateTab] = [
  markup.slice(0, markup.indexOf(TEMPLATE_TAB)),
  markup.slice(markup.indexOf(TEMPLATE_TAB)),
];

describe('the image picker', () => {
  it('names the template gallery on the template tab', () => {
    expect(templateTab).toContain("$root.t('gallery-template-loading')");
    expect(templateTab).toContain("$root.t('gallery-template-empty')");
    expect(templateTab).not.toContain("$root.t('gallery-mailing-");
  });

  it('names the email gallery on the email tab', () => {
    expect(emailTab).toContain("$root.t('gallery-mailing-empty')");
    expect(emailTab).not.toContain("$root.t('gallery-template-");
  });
});
