/**
 * @jest-environment jsdom
 */

'use strict';

// The head CSS section of the global Style tab, rendered from the template
// the editor ships (toolbox.tmpl.html) against the real predicates: what shows
// depends on the flag, on the stored CSS and on the HTML code blocks.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const {
  addHeadCssToViewModel,
} = require('../../../packages/editor/src/js/ext/head-css/view-model.js');

const TOOLBOX = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/editor/src/tmpl-badsender/toolbox.tmpl.html'
  ),
  'utf8'
);

// From the section's opening `ko if` to the comment closing it.
const SECTION = /<!-- ko if: \$root\.isHeadCssEditable\(\) \|\| \$root\.isHeadCssReadOnly\(\) -->[\s\S]*?<\/div>\s*<!-- \/ko -->/.exec(
  TOOLBOX
)[0];

function render({ htmlBlockEnabled, css, withBlock }) {
  const blocks = ko.observableArray(
    withBlock ? [ko.observable({ type: ko.observable('htmlCodeBlock') })] : []
  );
  const viewModel = {
    content: ko.observable({ mainBlocks: ko.observable({ blocks }) }),
    metadata: { htmlBlockEnabled },
    t: (key) => key,
    toggleHtmlCodeModal: jest.fn(),
  };
  addHeadCssToViewModel(viewModel);
  viewModel.headCss(css);

  const host = document.createElement('div');
  host.innerHTML = SECTION;
  document.body.appendChild(host);
  ko.applyBindings(viewModel, host);

  const visibleTexts = () =>
    Array.from(host.querySelectorAll('p, button'))
      .filter((element) => element.style.display !== 'none')
      .map((element) => element.textContent.trim());
  return { viewModel, blocks, host, visibleTexts };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the Style tab head CSS section', () => {
  it('offers editing with the flag on and a block present', () => {
    const { visibleTexts } = render({
      htmlBlockEnabled: true,
      css: '.a{}',
      withBlock: true,
    });
    expect(visibleTexts()).toEqual([
      'head-css-section-hint',
      'head-css-section-button',
    ]);
  });

  it('says the CSS is not exported with the flag on and no block', () => {
    const { visibleTexts, blocks } = render({
      htmlBlockEnabled: true,
      css: '.a{}',
      withBlock: false,
    });
    expect(visibleTexts()).toEqual([
      'head-css-section-hint',
      'head-css-not-exported-hint',
      'head-css-section-button',
    ]);

    blocks.push(ko.observable({ type: ko.observable('htmlCodeBlock') }));
    expect(visibleTexts()).not.toContain('head-css-not-exported-hint');
  });

  it('shows the CSS read-only with the flag off, CSS stored and a block', () => {
    const { visibleTexts, host, viewModel } = render({
      htmlBlockEnabled: false,
      css: '.a{}',
      withBlock: true,
    });
    expect(visibleTexts()).toEqual([
      'head-css-read-only-hint',
      'head-css-view-button',
    ]);

    host.querySelector('button').click();
    expect(viewModel.toggleHtmlCodeModal).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ readOnly: true })
    );
  });

  it.each([
    ['no CSS is stored', { css: '', withBlock: true }],
    ['no block is left', { css: '.a{}', withBlock: false }],
  ])('shows nothing with the flag off when %s', (_label, params) => {
    const { host } = render({ htmlBlockEnabled: false, ...params });
    expect(host.querySelector('.head-css-section')).toBeNull();
  });

  // The delete clears the CSS: the section goes, as there is nothing left to
  // view, and an undo bringing the CSS back brings it back.
  it('goes once the read-only CSS is deleted', () => {
    const { host, viewModel } = render({
      htmlBlockEnabled: false,
      css: '.a{}',
      withBlock: true,
    });

    viewModel.headCss('');
    expect(host.querySelector('.head-css-section')).toBeNull();

    viewModel.headCss('.a{}');
    expect(host.querySelector('.head-css-section')).not.toBeNull();
  });
});
