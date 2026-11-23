/**
 * @jest-environment jsdom
 */
'use strict';

const {
  keepToolbarInCanvas,
  installToolbarInCanvas,
} = require('../../packages/editor/src/js/ext/tinymce/toolbar-in-canvas');

const rect = (left, right) => ({ left, right, top: 0, bottom: 30 });

// The canvas between the left bar (400px) and a right panel (from 1200px).
function canvas(left = 400, right = 1200) {
  document.body.innerHTML = '<div id="main-edit-area"></div>';
  document.getElementById('main-edit-area').getBoundingClientRect = () =>
    rect(left, right);
}

function editorWithToolbar(left, right, { visible = true } = {}) {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => rect(left, right);
  const panel = {
    state: { get: (key) => (key === 'visible' ? visible : undefined) },
    getEl: () => element,
    moveBy: jest.fn(),
  };
  return { theme: { panel } };
}

describe('the text editor toolbar, with a right panel open', () => {
  beforeEach(() => canvas());

  it('is moved left to end where the canvas ends', () => {
    const editor = editorWithToolbar(770, 1600);
    expect(keepToolbarInCanvas(editor)).toBe(370);
    expect(editor.theme.panel.moveBy).toHaveBeenCalledWith(-370, 0);
  });

  it('never goes past the canvas left edge, wider than the canvas', () => {
    const editor = editorWithToolbar(500, 1330);
    expect(keepToolbarInCanvas(editor)).toBe(100);
    expect(editor.theme.panel.moveBy).toHaveBeenCalledWith(-100, 0);
  });

  it('stays where it is inside the canvas', () => {
    const editor = editorWithToolbar(500, 1100);
    expect(keepToolbarInCanvas(editor)).toBe(0);
    expect(editor.theme.panel.moveBy).not.toHaveBeenCalled();
  });

  it('is left alone while hidden, or without a canvas', () => {
    const hidden = editorWithToolbar(770, 1600, { visible: false });
    expect(keepToolbarInCanvas(hidden)).toBe(0);
    document.body.innerHTML = '';
    const editor = editorWithToolbar(770, 1600);
    expect(keepToolbarInCanvas(editor)).toBe(0);
    expect(keepToolbarInCanvas({})).toBe(0);
  });

  it('is kept in the canvas for every editor, installed once', () => {
    const handlers = [];
    const tinymce = { on: jest.fn((name, handler) => handlers.push(handler)) };
    installToolbarInCanvas(tinymce);
    installToolbarInCanvas(tinymce);
    expect(tinymce.on).toHaveBeenCalledTimes(1);
    const editor = { on: jest.fn() };
    handlers[0]({ editor });
    expect(editor.on).toHaveBeenCalledWith(
      'focus nodechange',
      expect.any(Function)
    );
  });
});
