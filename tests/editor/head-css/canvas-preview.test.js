/**
 * @jest-environment jsdom
 */

'use strict';

// The canvas preview exists so writing a rule shows its effect where the email
// is composed. Two things must hold: the rules never escape the canvas into the
// editor's own chrome, and the preview never becomes the source of truth — the
// export injects the CSS verbatim, and is unaffected by anything here.

const ko = require('knockout');

const {
  attachHeadCssPreview,
  STYLE_ELEMENT_ID,
} = require('../../../packages/editor/src/js/ext/head-css/canvas-preview.js');

function setup(initialCss) {
  const viewModel = { headCss: ko.observable(initialCss || '') };
  const subscription = attachHeadCssPreview(viewModel, document);
  return {
    viewModel,
    subscription,
    sheet: () => document.getElementById(STYLE_ELEMENT_ID),
  };
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('attachHeadCssPreview', () => {
  it('scopes the stylesheet to the canvas', () => {
    const { sheet } = setup('.classred{color:red}');

    expect(sheet().textContent).toContain('#main-wysiwyg-area .classred');
    // The bare selector must not be there on its own.
    expect(sheet().textContent).not.toMatch(/(^|})\s*\.classred/);
  });

  it('follows later edits', () => {
    const { viewModel, sheet } = setup('.a{color:red}');

    viewModel.headCss('.b{color:blue}');

    expect(sheet().textContent).toContain('#main-wysiwyg-area .b');
    expect(sheet().textContent).not.toContain('.a');
  });

  it('reuses one style element rather than stacking them', () => {
    const { viewModel } = setup('.a{color:red}');

    viewModel.headCss('.b{color:blue}');
    viewModel.headCss('.c{color:green}');

    expect(document.querySelectorAll('style').length).toBe(1);
  });

  it('clears the canvas when the CSS is emptied', () => {
    const { viewModel, sheet } = setup('.a{color:red}');

    viewModel.headCss('');

    expect(sheet().textContent).toBe('');
  });

  // Half-typed CSS is the normal state while editing: it must style what it
  // can, still scoped, and never throw.
  it('survives a stylesheet in the middle of being typed', () => {
    const { viewModel, sheet } = setup('.a{color:red}');

    expect(() => viewModel.headCss('.b{color:')).not.toThrow();
    expect(sheet().textContent).toContain('#main-wysiwyg-area .b');
  });

  it('does not throw on a document with no head', () => {
    const {
      renderPreview,
    } = require('../../../packages/editor/src/js/ext/head-css/canvas-preview.js');
    expect(() => renderPreview({}, '.a{color:red}')).not.toThrow();
  });

  it('does nothing without a headCss observable', () => {
    expect(attachHeadCssPreview({}, document)).toBeNull();
    expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
  });
});
