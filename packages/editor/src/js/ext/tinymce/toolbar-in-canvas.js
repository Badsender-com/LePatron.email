'use strict';

/**
 * The text editor's toolbar floats next to the field being edited, and is wider
 * than a narrow canvas (its AI button comes first for that reason, ADR 0011).
 * With a right panel open (comments, quality control, AI), the canvas ends
 * where the panel begins: a toolbar placed past that edge covers the panel.
 * It is moved left, so that it ends where the canvas does, never past the
 * canvas's left edge.
 */

// The area the email is edited in: it shrinks when a right panel opens.
const CANVAS_ID = 'main-edit-area';

/**
 * @param {Object} editor a TinyMCE 4 editor, inline
 * @param {Document} [doc]
 * @returns {number} how far the toolbar was moved left, in pixels
 */
function keepToolbarInCanvas(editor, doc = document) {
  const panel = editor && editor.theme && editor.theme.panel;
  if (!panel || typeof panel.getEl !== 'function') return 0;
  const visible = panel.state ? panel.state.get('visible') : panel._visible;
  const element = panel.getEl();
  const canvas = doc.getElementById(CANVAS_ID);
  if (!visible || !element || !canvas) return 0;

  const bounds = canvas.getBoundingClientRect();
  const toolbar = element.getBoundingClientRect();
  const overflow = toolbar.right - bounds.right;
  if (overflow <= 0) return 0;
  const shift = Math.min(overflow, Math.max(0, toolbar.left - bounds.left));
  if (shift > 0) panel.moveBy(-shift, 0);
  return shift;
}

// Installed once per TinyMCE, however many times the editor starts (a
// template swapped).
const installed = new WeakSet();

/**
 * Keep every inline editor's toolbar in the canvas: after TinyMCE places it,
 * on focus and on each change of the selection.
 * @param {Object} tinymce
 */
function installToolbarInCanvas(tinymce) {
  if (installed.has(tinymce)) return;
  installed.add(tinymce);
  tinymce.on('AddEditor', ({ editor }) => {
    // After the theme's own placement, which listens to the same events.
    const keep = () => setTimeout(() => keepToolbarInCanvas(editor), 0);
    editor.on('focus nodechange', keep);
  });
}

module.exports = { keepToolbarInCanvas, installToolbarInCanvas };
