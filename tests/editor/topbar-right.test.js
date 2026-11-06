/**
 * @jest-environment jsdom
 */

'use strict';

// The right of the top bar (boards « Topbar allégée »): the preview as a
// segmented control, the gallery, the history, then Save and Export, in
// native buttons with their names.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../packages/editor/src');
const main = fs.readFileSync(path.join(SRC, 'tmpl/main.tmpl.html'), 'utf8');
const download = fs.readFileSync(
  path.join(SRC, 'tmpl-badsender/download-buttons.html'),
  'utf8'
);
const fr = require('../../public/lang/badsender-fr.js');
const en = require('../../public/lang/badsender-en.js');

function parse(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('the right of the top bar', () => {
  const right = parse(main).querySelector('#toolbar .topbar-right');

  it('holds the preview, the history and Save, in that order', () => {
    const html = right.innerHTML;
    const preview = html.indexOf('topbar-segmented');
    const undo = html.indexOf('$root.undo.execute');
    const save = html.indexOf('$root.save.execute');
    expect(preview).toBeGreaterThan(-1);
    expect(preview).toBeLessThan(undo);
    expect(undo).toBeLessThan(save);
    expect(html).toContain("name: 'download-buttons'");
  });

  it('shows the preview as a group of pressed buttons, one per mode', () => {
    const group = right.querySelector('.topbar-segmented');
    expect(group.getAttribute('role')).toBe('group');
    const bind = group.innerHTML;
    ['both', 'desktop', 'mobile'].forEach((mode) =>
      expect(bind).toContain(`mode: '${mode}'`)
    );
    expect(bind).toContain("'aria-pressed'");
  });

  it('names every icon button for screen readers', () => {
    right.querySelectorAll('button').forEach((button) => {
      const bind = button.getAttribute('data-bind');
      // An aria-label, or its text from a label.
      const named =
        bind.includes("'aria-label'") ||
        button.innerHTML.includes('text: $root.t(');
      expect(named).toBe(true);
    });
  });

  it('keeps Save focusable when it cannot save, its reason in its title', () => {
    const save = [...right.querySelectorAll('button')].find((b) =>
      b.getAttribute('data-bind').includes('$root.save.execute')
    );
    const bind = save.getAttribute('data-bind');
    expect(bind).toContain("'aria-disabled'");
    expect(bind).toContain("$root.t('topbar-save-readonly')");
    expect(bind).not.toMatch(/\bdisable:/);
  });

  it('calls the download « Exporter », with a menu when there are several ways out', () => {
    const buttons = parse(download).querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b.innerHTML).toContain("t('topbar-export')"));
    const bind = buttons[1].getAttribute('data-bind');
    expect(bind).toContain('$root.exportMenu.toggle');
    expect(bind).toContain("'aria-expanded'");
    expect(buttons[1].getAttribute('aria-controls')).toBe('download-form-menu');
  });

  it('is 52px tall, as on the boards, for the canvas and the panels too', () => {
    const less = fs.readFileSync(
      path.join(SRC, 'css/style_mosaico.less'),
      'utf8'
    );
    expect(less).toMatch(/^@topbar-height: 52px;/m);
  });

  it.each(['topbar-export', 'topbar-preview-label', 'topbar-save-readonly'])(
    'has the label %s in French and in English',
    (key) => {
      expect(fr[key]).toEqual(expect.any(String));
      expect(en[key]).toEqual(expect.any(String));
    }
  );
});
