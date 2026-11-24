/**
 * @jest-environment jsdom
 */

'use strict';

// The composition's own rules, in the builder's own preview.
//
// Found by driving the editor in a browser, not by the suite: switching the
// preview to Mobile shrank the columns instead of stacking them. The markup
// was right and the stacking class was on both cells — and the iframe held
// one stylesheet, the preview's chrome, with nothing that defines that class.
//
// The acceptance tests of this epic checked the export and the canvas. They
// did not check the one place a user is told to look: "Une bascule Bureau /
// Mobile dans l'en-tête de l'édition — les colonnes s'empilent réellement
// dans l'aperçu, pas seulement en théorie."

const { openModal, unmountAll } = require('./drag-helpers.js');
const {
  DERIVED_STYLE_ID,
} = require('../../../packages/editor/src/js/vue/components/block-builder-modal/preview-surface.js');
const {
  ALWAYS_TRUE_MEDIA,
} = require('../../../packages/editor/src/js/ext/preview-media.js');
const {
  renderPreview: renderCanvas,
  STYLE_ELEMENT_ID: CANVAS_STYLE_ID,
} = require('../../../packages/editor/src/js/ext/head-css/canvas-preview.js');
const {
  scopeCss,
} = require('../../../packages/editor/src/js/ext/head-css/scope-css.js');
const {
  exportedHeadCss,
} = require('../../../packages/shared/head-css/exported-head-css.js');
const {
  serialiseState,
} = require('../../../packages/shared/block-builder/state.js');

afterEach(unmountAll);

const derivedSheet = (doc) => {
  const sheet = doc.getElementById(DERIVED_STYLE_ID);
  return sheet ? sheet.textContent : null;
};

/** Splits the single row into two halves, as the structure panel would. */
async function twoColumns() {
  const opened = await openModal(['text', 'button']);
  const [row] = opened.modal.state.rows;
  opened.modal.setRowWidths(row.id, [50, 50]);
  opened.modal.renderPreview();
  return opened;
}

describe('the mobile toggle in the builder preview', () => {
  it('carries no rule while the preview is on desktop', async () => {
    const { modal, doc } = await twoColumns();

    expect(modal.previewWidth).toBe(modal.desktopWidth);
    expect(derivedSheet(doc)).toBe('');
  });

  it('carries the stacking rule once the preview is on mobile', async () => {
    const { modal, doc } = await twoColumns();

    modal.previewWidth = modal.mobileWidth;
    await modal.$nextTick();

    expect(derivedSheet(doc)).toMatch(/display:\s*block/);
    expect(derivedSheet(doc)).toMatch(/width:\s*100%/);
  });

  // The rule and the class have to name each other. Either alone is the
  // failure that looks like success: markup that carries a class nothing
  // defines, or a rule nothing wears.
  it('names a class the preview markup actually carries', async () => {
    const { modal, doc } = await twoColumns();
    modal.previewWidth = modal.mobileWidth;
    await modal.$nextTick();

    const names = (
      derivedSheet(doc).match(/\.([\w-]+)\s*\{/g) || []
    ).map((match) => match.replace(/[.{\s]/g, ''));

    expect(names.length).toBeGreaterThan(0);
    names.forEach((name) => {
      expect(doc.body.querySelectorAll(`.${name}`).length).toBeGreaterThan(0);
    });
  });

  // The breakpoint cannot decide here: the iframe is 600px wide on desktop,
  // exactly the breakpoint, and `max-width` is inclusive — the condition as
  // written would stack the desktop preview. The toggle decides, by forcing
  // the condition on mobile, as the canvas does.
  it('decides by the toggle rather than by the iframe width', async () => {
    const { modal, doc } = await twoColumns();
    modal.previewWidth = modal.mobileWidth;
    await modal.$nextTick();

    expect(derivedSheet(doc)).toContain(ALWAYS_TRUE_MEDIA);
    expect(derivedSheet(doc)).not.toMatch(/max-width/);
  });

  it('takes the rule away again when the preview goes back to desktop', async () => {
    const { modal, doc } = await twoColumns();
    modal.previewWidth = modal.mobileWidth;
    await modal.$nextTick();
    modal.previewWidth = modal.desktopWidth;
    await modal.$nextTick();

    expect(derivedSheet(doc)).toBe('');
  });

  it('carries nothing for a composition with no column to stack', async () => {
    const { modal, doc } = await openModal(['text']);
    modal.previewWidth = modal.mobileWidth;
    await modal.$nextTick();

    expect(derivedSheet(doc)).toBe('');
  });
});

// One rule for the two previews of a composed block: the modal's Mobile view
// and the canvas's mobile mode start from the stylesheet the export carries
// and force it the same way. Two derivations had drifted before — the modal
// stripped the media query and assumed every class was a mobile one.
describe('the modal and the canvas on mobile', () => {
  afterEach(() => {
    const canvasSheet = document.getElementById(CANVAS_STYLE_ID);
    if (canvasSheet) canvasSheet.remove();
  });

  it('force the same rule for the same block', async () => {
    const { modal, doc } = await twoColumns();
    modal.previewWidth = modal.mobileWidth;
    await modal.$nextTick();

    renderCanvas(
      document,
      exportedHeadCss({
        composedStates: [serialiseState(modal.state)],
        hasHtmlCodeBlock: false,
        authorCss: '',
      }),
      'mobile'
    );
    const canvas = document.getElementById(CANVAS_STYLE_ID).textContent;

    expect(canvas).toContain(ALWAYS_TRUE_MEDIA);
    // The canvas scopes its selectors to the editing area; the modal, an
    // iframe of its own, has nothing to scope. Scoped the canvas's way, the
    // modal's sheet is the canvas's, character for character.
    expect(scopeCss(derivedSheet(doc), '#main-wysiwyg-area')).toBe(canvas);
  });
});
