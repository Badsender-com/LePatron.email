/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * What the AI actions read from the email being edited
 * (ext/ai-panel/editor-access.js): its blocks, how they are named, and the
 * text fields of a block, as the action registry and the toolbars ask.
 */

const ko = require('knockout');
const {
  createEditorAccess,
} = require('../../../packages/editor/src/js/ext/ai-panel/editor-access');

const block = (type, n, fields = {}) =>
  ko.observable({
    id: ko.observable(`ko_${type}_${n}`),
    type: ko.observable(type),
    ...Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, ko.observable(value)])
    ),
  });

const container = (blocks) =>
  ko.observable({ blocks: ko.observableArray(blocks) });

function editorOf() {
  const image = block('imageBlock', 2, { imageAlt: '', image: 'chat.png' });
  const content = ko.observable({
    // A fixed block of the template, outside any container.
    preheaderBlock: ko.observable({
      id: ko.observable('ko_preheaderBlock_1'),
      type: ko.observable('preheaderBlock'),
      preheaderText: ko.observable('Voir en ligne'),
    }),
    headerBlocks: container([block('textBlock', 7, { text: 'En-tête' })]),
    mainBlocks: container([
      block('textBlock', 3, {
        titleText: 'Les soldes',
        button: {
          text: ko.observable('Go'),
          url: ko.observable('https://a.b'),
        },
      }),
      image,
      block('separatorBlock', 4, { color: '#cccccc' }),
    ]),
  });
  const viewModel = {
    metadata: { id: 'm1', hasTextGenerationFeature: true },
    content,
    blockDefs: ko.observable([]),
    currentUser: () => null,
  };
  return { editor: createEditorAccess(viewModel), image };
}

describe('ai panel: what the actions read from the email', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('the blocks of the email', () => {
    it('are read from the canvas in reading order, fields left out', () => {
      document.body.innerHTML = `
        <div id="main-wysiwyg-area">
          <div id="ko_preheaderBlock_1"></div>
          <div id="ko_textBlock_3">
            <div id="ko_textBlock_3_titleText"></div>
          </div>
          <div id="ko_imageBlock_2"></div>
        </div>`;
      expect(editorOf().editor.blocks()).toEqual([
        { blockId: 'ko_preheaderBlock_1', blockType: 'preheaderBlock' },
        { blockId: 'ko_textBlock_3', blockType: 'textBlock' },
        { blockId: 'ko_imageBlock_2', blockType: 'imageBlock' },
      ]);
    });
  });

  describe('the name of a block', () => {
    // Numbered among the blocks of every container, as the quality drawer.
    it('numbers a block of any container among those of its type', () => {
      const { editor } = editorOf();
      expect(editor.blockLabel('ko_textBlock_7')).toBe('Text #1');
      expect(editor.blockLabel('ko_textBlock_3')).toBe('Text #2');
      expect(editor.blockLabel('ko_imageBlock_2')).toBe('Image');
    });

    it('names a fixed block of the template by its type', () => {
      expect(editorOf().editor.blockLabel('ko_preheaderBlock_1')).toBe(
        'Preheader'
      );
    });
  });

  describe('going to a block', () => {
    it('reaches a block of any container', () => {
      const { editor } = editorOf();
      expect(editor.canGoToBlock('ko_textBlock_7')).toBe(true);
      expect(editor.canGoToBlock('ko_imageBlock_2')).toBe(true);
    });

    it('does not reach a fixed block of the template, nor an unknown one', () => {
      const { editor } = editorOf();
      expect(editor.canGoToBlock('ko_preheaderBlock_1')).toBe(false);
      expect(editor.canGoToBlock('ko_textBlock_99')).toBe(false);
    });
  });

  describe('the text of a block', () => {
    it('lists the paths of its text fields, from the model alone', () => {
      const { editor } = editorOf();
      const styles = jest.spyOn(window, 'getComputedStyle');
      expect(editor.textPathsOf('ko_textBlock_3')).toEqual([
        'titleText',
        'button.text',
      ]);
      expect(editor.textPathsOf('ko_preheaderBlock_1')).toEqual([
        'preheaderText',
      ]);
      // Nothing of the rendering is read.
      expect(styles).not.toHaveBeenCalled();
      styles.mockRestore();
    });
  });
});
