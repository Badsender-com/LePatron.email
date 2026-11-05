/**
 * @jest-environment jsdom
 */

'use strict';

// The AI tools are hidden from whoever may not edit the content (ADR 0020):
// the editor reads `canUseTextGeneration`, computed by the server for this
// user on this email, not `hasTextGenerationFeature`, which says the feature
// is on for the company.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const MAIN = fs.readFileSync(
  path.join(__dirname, '../../../packages/editor/src/tmpl/main.tmpl.html'),
  'utf8'
);

describe('the AI tools, for this user on this email', () => {
  it('shows the panel button from canUseTextGeneration', () => {
    const condition = /<!-- ko if: ([^>]*) -->\s*<button id="ai-toggle"/.exec(
      MAIN
    )[1];
    expect(condition).toContain('$root.metadata.canUseTextGeneration');
    expect(condition).not.toContain('hasTextGenerationFeature');
  });

  it.each([
    ['a reviewer, the feature on for the company', false, false],
    ['a writer', true, true],
  ])('mounts the panel and its ways in for %s', (_label, canUse, mounted) => {
    jest.isolateModules(() => {
      const plugin = require('../../../packages/editor/src/js/vue/aiPanelPlugin.js');
      document.body.innerHTML = '<div id="ai-panel"></div>';
      const vm = {
        metadata: {
          hasTextGenerationFeature: true,
          canUseTextGeneration: canUse,
        },
        selectedBlock: ko.observable(null),
        selectedItem: ko.observable(null),
        t: (key) => key,
      };
      plugin.viewModel(vm);
      plugin.init(vm);
      expect(vm.aiPanelReady()).toBe(mounted);
      plugin.dispose();
    });
  });

  it.each([
    [false, false],
    [true, true],
  ])(
    'offers AI actions in the registry context: %s gives %s',
    (canUse, expected) => {
      const {
        createEditorAccess,
      } = require('../../../packages/editor/src/js/ext/ai-panel/editor-access.js');
      const vm = {
        metadata: {
          hasTextGenerationFeature: true,
          canUseTextGeneration: canUse,
        },
        content: ko.observable({}),
      };
      expect(createEditorAccess(vm).context().textGeneration).toBe(expected);
    }
  );

  it.each([
    [false, false],
    [true, true],
  ])('adds the text editor AI button: %s gives %s', (canUse, expected) => {
    jest.isolateModules(() => {
      global.$ = global.jQuery = require('jquery');
      // The module's own knockout, in this isolated registry.
      const isolatedKo = require('knockout');
      isolatedKo.bindingHandlers.wysiwyg = {};
      const extend = require('../../../packages/editor/src/js/ext/badsender-extend-text-editor.js');
      const plugin = extend({ tinymce: {}, lang: 'en' });
      plugin.viewModel({
        metadata: {
          hasTextGenerationFeature: true,
          canUseTextGeneration: canUse,
        },
      });
      expect(
        String(isolatedKo.bindingHandlers.wysiwyg.fullOptions.toolbar1 || '')
      ).toEqual(
        expected
          ? expect.stringContaining('aiactions')
          : expect.not.stringContaining('aiactions')
      );
    });
  });
});
