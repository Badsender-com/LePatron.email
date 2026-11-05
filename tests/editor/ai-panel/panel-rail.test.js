/**
 * @jest-environment jsdom
 */

'use strict';

// The panel rail (ADR 0020): the buttons of the right panels leave the top bar
// for a rail on the right edge, below it.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../../packages/editor/src');
const main = fs.readFileSync(path.join(SRC, 'tmpl/main.tmpl.html'), 'utf8');
const badge = fs.readFileSync(
  path.join(SRC, 'tmpl-badsender/panel-rail-quality-badge.tmpl.html'),
  'utf8'
);

function parse(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('the panel rail', () => {
  const page = parse(main);

  it.each(['toolcomments', 'toolquality', 'toolai'])(
    'has the one button that controls %s: the focus goes back to it on close',
    (id) => {
      const controls = page.querySelectorAll(`[aria-controls="${id}"]`);
      expect(controls).toHaveLength(1);
      expect(controls[0].tagName).toBe('BUTTON');
      expect(controls[0].closest('nav.panel-rail')).not.toBeNull();
    }
  );

  it('sits outside the canvas, whose click unselects the block', () => {
    const rail = page.querySelector('nav.panel-rail');
    expect(rail.closest('#main-edit-area')).toBeNull();
    expect(rail.closest('#toolbar')).toBeNull();
  });

  it('names each panel in its button, for screen readers and as a tooltip', () => {
    page.querySelectorAll('.panel-rail__button').forEach((button) => {
      expect(button.getAttribute('data-bind')).toMatch(/title: \$root\.t\(/);
      expect(button.querySelector('.panel-rail__sr')).not.toBeNull();
    });
  });

  it('says its quality badge in words, chosen by rail-badge.js', () => {
    const item = parse(badge).querySelector('.panel-rail__badge');
    expect(item.querySelector('.panel-rail__sr')).not.toBeNull();
    expect(badge).toContain('$root.quality.railBadge()');
  });

  it('comes after the top bar and the panels: the keyboard reaches it after the top bar', () => {
    const rail = main.indexOf('class="panel-rail"');
    expect(main.indexOf('id="toolbar"')).toBeLessThan(rail);
    expect(main.indexOf('id="main-toolbox"')).toBeLessThan(rail);
  });
});
