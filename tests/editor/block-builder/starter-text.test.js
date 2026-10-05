/**
 * @jest-environment jsdom
 */

'use strict';

// A fresh text or button is blank, and the preview shows a starter in it.
//
// The decision pinned here: the starter is PREVIEW-ONLY. It used to be written
// into the element, which made it real content — exported as if the user had
// typed it, and sent to recipients from any block nobody went back to. Now the
// state stays blank, the preview draws the words greyed, the settings field
// shows them as a placeholder, and an element left untouched exports nothing.

const Vue = require('vue/dist/vue.common');

const {
  openModal,
  unmountAll,
  layOutRows,
  rowOf,
  startPaletteDrag,
  dropAt,
} = require('./drag-helpers.js');
const {
  STARTER_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

// The test dictionary is the identity, so a starter shows up as its key.
const TEXT_STARTER = 'block-builder-starter-text';
const BUTTON_STARTER = 'block-builder-starter-button';

afterEach(unmountAll);

describe('a new element stays blank', () => {
  it.each([
    ['text', 'content'],
    ['button', 'label'],
  ])('adds a %s with nothing in its %s', async (type, key) => {
    const { modal } = await openModal([]);

    modal.addElement(type);

    expect(modal.selected[key]).toBe('');
  });
});

describe('the preview shows a starter in it', () => {
  it.each([
    ['text', TEXT_STARTER],
    ['button', BUTTON_STARTER],
  ])('draws the %s starter, marked as one', async (type, starter) => {
    const { modal, doc } = await openModal([type]);

    const row = rowOf(doc, modal.selected.id);
    expect(row.textContent).toContain(starter);
    expect(row.getAttribute(STARTER_ATTRIBUTE)).toBe(type);
  });

  it('gives way to what the user types', async () => {
    const { modal, doc } = await openModal(['text']);

    modal.applySetting({ key: 'content', value: 'Bonjour' });
    modal.renderPreview();

    const row = rowOf(doc, modal.selected.id);
    expect(row.textContent).toContain('Bonjour');
    expect(row.textContent).not.toContain(TEXT_STARTER);
    expect(row.hasAttribute(STARTER_ATTRIBUTE)).toBe(false);
  });

  it('comes back when the text is emptied again', async () => {
    const { modal, doc } = await openModal(['text']);
    modal.applySetting({ key: 'content', value: 'Bonjour' });

    modal.applySetting({ key: 'content', value: '<br>' });
    modal.renderPreview();

    expect(rowOf(doc, modal.selected.id).textContent).toContain(TEXT_STARTER);
  });
});

// An image with no source renders nothing: without a floor its row is zero
// pixels tall — it cannot be clicked, and nothing can be dropped against it.
describe('an empty element still takes room in the preview', () => {
  const stylesheet = (doc) => doc.querySelector('style').textContent;

  it('marks an image with no source, for the preview to frame', async () => {
    const { modal, doc } = await openModal(['image']);

    const row = rowOf(doc, modal.selected.id);
    expect(row.getAttribute(STARTER_ATTRIBUTE)).toBe('image');
    expect(stylesheet(doc)).toMatch(
      new RegExp(`\\[${STARTER_ATTRIBUTE}="image"\\]\\{height:\\d+px`)
    );
  });

  it('stops marking it once a picture is chosen', async () => {
    const { modal, doc } = await openModal(['image']);

    modal.applySetting({ key: 'src', value: 'https://cdn.example/a.png' });
    modal.renderPreview();

    expect(rowOf(doc, modal.selected.id).hasAttribute(STARTER_ATTRIBUTE)).toBe(
      false
    );
  });

  // `min-height` is ignored on a table cell; `height` there is the floor.
  it('gives every row a floor that a table cell honours', async () => {
    const { doc } = await openModal(['spacer']);

    expect(stylesheet(doc)).toMatch(/\[data-lp-el\]\{[^}]*;height:\d+px/);
    expect(stylesheet(doc)).not.toContain('min-height');
  });
});

describe('the starter never reaches the block', () => {
  it('applies an untouched text, image and dropped button without starters', async () => {
    const { modal, doc, markup } = await openModal(['text', 'image']);
    layOutRows(doc, 100);
    startPaletteDrag('button');
    dropAt(doc, 190);
    // Shown in the preview, or this proves nothing.
    expect(modal.previewMarkup).toContain(BUTTON_STARTER);

    modal.handleApply();

    const written = markup();
    expect(written).toContain('<table role="presentation"');
    expect(written).not.toContain(TEXT_STARTER);
    expect(written).not.toContain(BUTTON_STARTER);
    expect(written).not.toContain(STARTER_ATTRIBUTE);
  });
});

describe('the settings field shows it as a placeholder', () => {
  it('on the button label', async () => {
    const { modal } = await openModal([]);
    modal.addElement('button');
    await Vue.nextTick();

    const input = document.querySelector('.bb-settings input[type="text"]');
    expect(input.getAttribute('placeholder')).toBe(BUTTON_STARTER);
    expect(input.value).toBe('');
  });

  it('on the text, until something is typed', async () => {
    const { modal } = await openModal([]);
    modal.addElement('text');
    await Vue.nextTick();

    const rich = document.querySelector('.bb-rich');
    expect(rich.classList.contains('bb-rich--blank')).toBe(true);
    expect(
      rich.querySelector('.bb-rich__field').getAttribute('placeholder')
    ).toBe(TEXT_STARTER);

    modal.applySetting({ key: 'content', value: 'Bonjour' });
    await Vue.nextTick();

    expect(rich.classList.contains('bb-rich--blank')).toBe(false);
  });
});
