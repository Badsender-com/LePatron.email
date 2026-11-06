/**
 * @jest-environment jsdom
 */

'use strict';

// The left bar of the editor (boards « Éditeur v2 », decision of
// 2026-11-06): « Blocs », « Images », « Réglages », two sub-tabs each, read
// from the state the editor already keeps.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const leftBar = require('../../packages/editor/src/js/ext/left-bar.js');

const SRC = path.join(__dirname, '../../packages/editor/src');
const read = (file) => fs.readFileSync(path.join(SRC, file), 'utf8');
const fr = require('../../public/lang/badsender-fr.js');
const en = require('../../public/lang/badsender-en.js');

function editor(blockDefs = []) {
  const vm = {
    showGallery: ko.observable(false),
    selectedTool: ko.observable(0),
    selectedImageTab: ko.observable(0),
    blocksActiveTab: ko.observable('TEMPLATE_BLOCKS'),
    blockDefs: ko.observableArray(blockDefs),
    t: (key, params) => (params ? `${key}:${params.name}` : key),
    isSyntheticBlock: (def) => def.synthetic === true,
    syntheticBlockLabelKey: () => 'HTML code',
  };
  leftBar(vm);
  return vm;
}

const labels = (vm) =>
  vm.leftBarSubTabs().map((tab) => (tab.active ? `*${tab.label}` : tab.label));

describe('the tabs of the left bar', () => {
  it('opens on « Blocs », its template blocks first', () => {
    const vm = editor();
    expect(vm.leftBarTab()).toBe('blocks');
    expect(labels(vm)).toEqual([
      '*left-bar-template-blocks',
      'left-bar-saved-blocks',
    ]);
  });

  it('shows the galleries under « Images », the email’s first', () => {
    const vm = editor();
    vm.showLeftBarTab('images');
    expect(vm.showGallery()).toBe(true);
    expect(vm.leftBarTab()).toBe('images');
    expect(labels(vm)).toEqual(['*gallery-mailing', 'gallery-template']);
    vm.leftBarSubTabs()[1].select();
    expect(vm.selectedImageTab()).toBe(1);
  });

  it('shows the content then the styles under « Réglages »', () => {
    const vm = editor();
    vm.showLeftBarTab('settings');
    expect(vm.selectedTool()).toBe(1);
    expect(labels(vm)).toEqual(['*left-bar-content', 'left-bar-styles']);
    vm.leftBarSubTabs()[1].select();
    expect(vm.selectedTool()).toBe(2);
    // Back to « Réglages » later: on the sub-tab left open.
    vm.showLeftBarTab('blocks');
    vm.showLeftBarTab('settings');
    expect(vm.selectedTool()).toBe(2);
  });

  it('leaves the gallery for another tab', () => {
    const vm = editor();
    vm.showLeftBarTab('images');
    vm.showLeftBarTab('blocks');
    expect(vm.showGallery()).toBe(false);
    expect(vm.leftBarTab()).toBe('blocks');
  });

  it('follows the editor when it moves by itself, a block selected or an image to choose', () => {
    const vm = editor();
    vm.selectedTool(1);
    expect(vm.leftBarTab()).toBe('settings');
    vm.showGallery(true);
    expect(vm.leftBarTab()).toBe('images');
  });

  it('switches the saved blocks on and off', () => {
    const vm = editor();
    vm.leftBarSubTabs()[1].select();
    expect(vm.blocksActiveTab()).toBe('CUSTOM_BLOCKS');
  });
});

describe('the search of the template blocks', () => {
  const defs = [
    { type: 'heroBlock' },
    { type: ko.observable('footerBlock') },
    { type: 'html', synthetic: true },
  ];

  it('keeps every block while nothing is typed', () => {
    const vm = editor(defs);
    expect(defs.every(vm.matchesBlockSearch)).toBe(true);
    expect(vm.noBlockMatches()).toBe(false);
  });

  it('matches the names the cards show, whatever the case', () => {
    const vm = editor(defs);
    vm.blockSearch('  FOOTER ');
    expect(defs.map(vm.matchesBlockSearch)).toEqual([false, true, false]);
    vm.blockSearch('html code');
    expect(defs.map(vm.matchesBlockSearch)).toEqual([false, false, true]);
  });

  it('says when no block matches', () => {
    const vm = editor(defs);
    vm.blockSearch('carousel');
    expect(vm.noBlockMatches()).toBe(true);
  });
});

describe('the markup of the left bar and of the top bar', () => {
  const root = document.createElement('div');
  root.innerHTML = read('tmpl-badsender/toolbox.tmpl.html');

  it('draws three tabs and the sub-tabs of the open one, as pressed buttons', () => {
    const segmented = root.querySelector('.left-bar-nav .left-bar-segmented');
    const html = segmented.innerHTML;
    ['blocks', 'images', 'settings'].forEach((tab) =>
      expect(html).toContain(`tab: '${tab}'`)
    );
    expect(html).toContain("'aria-pressed'");
    const sub = root.querySelector('.left-bar-subtabs');
    expect(sub.getAttribute('data-bind')).toContain('$root.leftBarSubTabs()');
  });

  it('searches the template blocks', () => {
    const input = root.querySelector('#toolblocks .left-bar-search__input');
    expect(input.getAttribute('data-bind')).toContain(
      'textInput: $root.blockSearch'
    );
  });

  it('starts the top bar with the way back, then the name; the gallery left it', () => {
    const main = read('tmpl/main.tmpl.html');
    const toolbar = main.slice(main.indexOf('<div id="toolbar"'));
    expect(toolbar.indexOf('topbar-back')).toBeLessThan(
      toolbar.indexOf("name: 'edit-name'")
    );
    expect(main).not.toContain('$root.showGallery(!$root.showGallery())');
  });

  it('renames from a named button, for whom may rename only', () => {
    const name = read('tmpl-badsender/edit-name.tmpl.html');
    expect(name).toMatch(
      /ko if: \$root\.canRenameCreation\(\)[\s\S]*class="creation-name__button"[\s\S]*'aria-label'/
    );
  });

  it('has its words in French and in English', () => {
    [
      'left-bar-blocks',
      'left-bar-images',
      'left-bar-settings',
      'left-bar-template-blocks',
      'left-bar-saved-blocks',
      'left-bar-content',
      'left-bar-styles',
      'left-bar-block-search',
      'left-bar-block-search-empty',
      'topbar-rename',
      'block-tool-comment',
    ].forEach((key) => {
      expect(fr[key]).toEqual(expect.any(String));
      expect(en[key]).toEqual(expect.any(String));
    });
    expect(fr['gallery-mailing']).toBe('Dans cet email');
    expect(fr['gallery-template']).toBe('Galerie du template');
  });
});
