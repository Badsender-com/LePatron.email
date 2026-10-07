'use strict';

/**
 * Acceptance tests of the AI panel (epic #1177): one right-hand place for
 * comments, quality control and the AI panel, one of them open at a time.
 *
 * Seam: the editor state that says which right panel is open, with the
 * per-panel flags the existing templates bind to (`showComments`,
 * `showQuality`) kept working on top of it (ADR 0004).
 */

const ko = require('knockout');

// Turned on by #1179 (one right-hand panel for comments and quality control)
describe.skip('ai panel: the right panel state', () => {
  let createRightPanel;
  let panel;

  beforeAll(() => {
    // Required here, not at the top of the file: the module ships with #1179.
    ({
      createRightPanel,
    } = require('../../../packages/editor/src/js/ext/right-panel'));
  });

  beforeEach(() => {
    panel = createRightPanel(ko);
  });

  it('opens with nothing open', () => {
    expect(panel.open()).toBeNull();
    expect(panel.anyOpen()).toBe(false);
  });

  it('opens one panel at a time: opening one closes the other', () => {
    panel.show('comments');
    expect(panel.open()).toBe('comments');
    panel.show('ai');
    expect(panel.open()).toBe('ai');
    expect(panel.isOpen('comments')).toBe(false);
  });

  it('toggles a panel, and closes it when it is the open one', () => {
    panel.toggle('quality');
    expect(panel.open()).toBe('quality');
    panel.toggle('quality');
    expect(panel.open()).toBeNull();
  });

  it('closes whatever is open', () => {
    panel.show('ai');
    panel.hide();
    expect(panel.open()).toBeNull();
  });

  it('keeps the per-panel flags the templates bind to, both ways', () => {
    const showComments = panel.flag('comments');
    const showQuality = panel.flag('quality');
    showComments(true);
    expect(panel.open()).toBe('comments');
    showQuality(true);
    expect(showComments()).toBe(false);
    expect(panel.open()).toBe('quality');
    showQuality(false);
    expect(panel.open()).toBeNull();
  });

  it('closing a panel that is not open changes nothing', () => {
    panel.show('comments');
    panel.flag('ai')(false);
    expect(panel.open()).toBe('comments');
  });

  it('tells the layout that a right panel is open, whichever it is, so the canvas and the comments rail make room', () => {
    const seen = [];
    panel.anyOpen.subscribe((value) => seen.push(value));
    panel.show('quality');
    panel.show('ai');
    panel.hide();
    expect(seen).toEqual([true, false]);
  });

  it('refuses a panel it does not know', () => {
    expect(() => panel.show('gallery')).toThrow();
  });
});
