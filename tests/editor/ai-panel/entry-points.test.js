/**
 * @jest-environment jsdom
 */
'use strict';

/**
 * The AI entry points of the toolbars (#1257): the block toolbar's AI tool and
 * the text editor's AI button. Both show what the action registry offers on
 * their target, and nothing else; both say what they open.
 */

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
// The panel's component is not under test: it only records the panel it got.
jest.mock(
  '../../../packages/editor/src/js/vue/components/ai-panel/ai-panel',
  () => ({
    AiPanel: {
      props: ['vm', 'panel'],
      created() {
        global.mockMountedPanels.push(this.panel);
      },
      template: '<div class="ai-panel-stub"></div>',
    },
  })
);
// Registers a TinyMCE plugin on load: not the one under test.
jest.mock('../../../packages/editor/src/js/ext/link-with-color', () => ({}));

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const Vue = require('vue/dist/vue.common');

global.ko = ko;
Vue.config.productionTip = false;
Vue.config.devtools = false;

const aiPanelPlugin = require('../../../packages/editor/src/js/vue/aiPanelPlugin.js');
const {
  aiActions,
} = require('../../../packages/editor/src/js/ext/badsender-extend-tinymce.js');
const {
  withAiActions,
} = require('../../../packages/editor/src/js/ext/badsender-extend-text-editor.js');
const { CAPABILITIES } = require('../../../packages/shared/access/roles.js');

const TOOLBAR = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/editor/src/tmpl/block-wysiwyg.tmpl.html'
  ),
  'utf8'
);
// The block toolbar's AI tool, with the condition around it.
const AI_TOOL = /<!-- ko if: \$root\.offersAiOnBlock[\s\S]*?<!-- \/ko -->/.exec(
  TOOLBAR
)[0];

const block = (type, n, fields = {}) => ({
  id: ko.observable(`ko_${type}_${n}`),
  type: ko.observable(type),
  ...Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, ko.observable(value)])
  ),
});

const TEXT = block('textBlock', 3, { titleText: 'Les soldes commence' });
const IMAGE = block('imageBlock', 2, { imageAlt: '', image: 'chat.png' });
const SEPARATOR = block('separatorBlock', 4, { color: '#cccccc' });
const PREHEADER = block('preheaderBlock', 1, { preheaderText: 'En ligne' });

function editorViewModel() {
  const vm = {
    metadata: {
      id: 'm1',
      hasTextGenerationFeature: true,
      textGenerationSkills: [
        'redaction.objet',
        'redaction.pre-header',
        'redaction.correction',
      ],
    },
    t: (key) => key,
    currentUser: ko.observable({
      capabilities: [CAPABILITIES.MAILING_EDIT_CONTENT],
    }),
    selectedBlock: ko.observable(null),
    selectedItem: ko.observable(null),
    content: ko.observable({
      preheaderBlock: ko.observable(PREHEADER),
      mainBlocks: ko.observable({
        blocks: ko.observableArray([TEXT, IMAGE, SEPARATOR]),
      }),
    }),
    blockDefs: ko.observable([]),
    emailMetadataStore: {
      isActive: () => true,
      snapshot: () => ({ subject: 'Objet' }),
    },
  };
  // As the editor's: the selection, whatever the panel says.
  vm.selectBlock = jest.fn((selected) => vm.selectedBlock(selected));
  aiPanelPlugin.viewModel(vm);
  return vm;
}

function startEditor() {
  const vm = editorViewModel();
  document.body.innerHTML =
    '<div id="ai-panel"><ai-panel-plugin></ai-panel-plugin></div>';
  aiPanelPlugin.init(vm);
  const [panel] = global.mockMountedPanels;
  return { vm, panel };
}

beforeEach(() => {
  global.mockMountedPanels = [];
  IMAGE.imageAlt('');
});

afterEach(() => {
  aiPanelPlugin.dispose();
  ko.cleanNode(document.body);
  document.body.innerHTML = '';
});

describe('the AI entry points of the toolbars', () => {
  describe('the block toolbar', () => {
    it('offers nothing before the panel exists', () => {
      const vm = editorViewModel();
      expect(vm.offersAiOnBlock(TEXT)).toBe(false);
    });

    it('offers what the registry offers on the block, and nothing else', () => {
      const { vm, panel } = startEditor();
      const offered = (b) =>
        panel.offerNow()({
          kind: 'block',
          blockId: b.id(),
          blockType: b.type(),
        }).actions.length > 0;

      for (const b of [TEXT, IMAGE, SEPARATOR]) {
        expect(vm.offersAiOnBlock(b)).toBe(offered(b));
      }
      expect(vm.offersAiOnBlock(TEXT)).toBe(true);
      // No text, nothing to correct: neither the tool nor the panel offers it.
      expect(vm.offersAiOnBlock(SEPARATOR)).toBe(false);
      expect(vm.offersAiOnBlock(IMAGE)).toBe(false);
    });

    it('is named after the action it opens', () => {
      const { vm } = startEditor();
      expect(vm.aiBlockToolAttributes(TEXT)).toEqual({
        title: 'ai-field-correct-label',
        'aria-label': 'ai-field-correct-label',
      });
      // The block that holds the preheader opens the preheader's action.
      expect(vm.aiBlockToolAttributes(PREHEADER).title).toBe(
        'ai-panel-action-preheader'
      );
    });

    describe('rendered', () => {
      function render(vm, b) {
        vm.block = b;
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div id="toolbar"><!-- ko with: block -->${AI_TOOL}<!-- /ko --></div>`
        );
        ko.applyBindings(vm, document.getElementById('toolbar'));
      }
      const tool = () => document.querySelector('.tool.ai-actions');

      it('is a button the keyboard reaches, named, its icon hidden', () => {
        const { vm } = startEditor();
        render(vm, TEXT);
        expect(tool().getAttribute('role')).toBe('button');
        expect(tool().getAttribute('tabindex')).toBe('0');
        expect(tool().getAttribute('aria-label')).toBe(
          'ai-field-correct-label'
        );
        expect(tool().getAttribute('title')).toBe('ai-field-correct-label');
        expect(
          tool().querySelector('.lucide').getAttribute('aria-hidden')
        ).toBe('true');
      });

      it('shows once the panel exists, and once the block has text', () => {
        const vm = editorViewModel();
        render(vm, IMAGE);
        expect(tool()).toBeNull();

        document.body.insertAdjacentHTML(
          'beforeend',
          '<div id="ai-panel"><ai-panel-plugin></ai-panel-plugin></div>'
        );
        aiPanelPlugin.init(vm);
        // Mounted, but the image has no alternative text yet.
        expect(tool()).toBeNull();

        IMAGE.imageAlt('Un chat qui dort');
        expect(tool()).not.toBeNull();

        aiPanelPlugin.dispose();
        expect(tool()).toBeNull();
      });

      it('selects the block, then opens its action, on a click', () => {
        const { vm, panel } = startEditor();
        render(vm, TEXT);
        let sessionWhenSelected;
        vm.selectBlock.mockImplementation((selected) => {
          sessionWhenSelected = panel.session();
          vm.selectedBlock(selected);
        });

        tool().click();

        expect(vm.selectBlock).toHaveBeenCalledWith(TEXT);
        expect(sessionWhenSelected).toBeNull();
        expect(vm.selectedBlock()).toBe(TEXT);
        expect(vm.showAi()).toBe(true);
        expect(panel.session().state).toMatchObject({
          action: 'correct-text',
          target: { kind: 'block', blockId: 'ko_textBlock_3' },
        });
        // The selection it made is the action's own block: nothing to report.
        expect(panel.selectionChanged()).toBeNull();
      });

      it.each(['Enter', ' '])('opens it with %p', (key) => {
        const { vm, panel } = startEditor();
        render(vm, TEXT);
        const event = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        tool().dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(vm.selectedBlock()).toBe(TEXT);
        expect(panel.session().state.action).toBe('correct-text');
      });

      it('lets any other key through', () => {
        const { vm, panel } = startEditor();
        render(vm, TEXT);
        const event = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        });
        tool().dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        expect(vm.selectBlock).not.toHaveBeenCalled();
        expect(panel.session()).toBeNull();
      });
    });
  });

  describe('the text editor', () => {
    const CANVAS = `
      <div id="ko_textBlock_3">
        <div id="ko_textBlock_3_titleText" contenteditable="true">Les soldes</div>
        <div id="custom" contenteditable="true">Un texte du modèle</div>
      </div>`;

    it('opens the field it edits', () => {
      const { vm, panel } = startEditor();
      document.body.insertAdjacentHTML('beforeend', CANVAS);
      vm.openAiOnElement(document.getElementById('ko_textBlock_3_titleText'));
      expect(panel.session().state.target).toEqual({
        kind: 'blockField',
        blockId: 'ko_textBlock_3',
        blockType: 'textBlock',
        field: 'titleText',
      });
    });

    it('opens its block when no text field matches the element', () => {
      const { vm, panel } = startEditor();
      document.body.insertAdjacentHTML('beforeend', CANVAS);
      vm.openAiOnElement(document.getElementById('custom'));
      expect(panel.session().state.target).toEqual({
        kind: 'block',
        blockId: 'ko_textBlock_3',
        blockType: 'textBlock',
      });
    });

    describe('its AI button', () => {
      // A TinyMCE editor and the button it renders, as far as the plugin goes.
      function renderButton(vm, element) {
        let settings;
        const handlers = {};
        const editor = {
          addButton: (name, given) => {
            settings = given;
          },
          on: (name, handler) => {
            handlers[name] = handler;
          },
          getElement: () => element,
        };
        aiActions(vm)(editor);
        const group = { items: () => ({ length: 1 }), visible: jest.fn() };
        const button = {
          settings,
          parent: () => group,
          visible: jest.fn(),
          aria: jest.fn(),
        };
        settings.onPostRender.call(button);
        return { settings, group, button, focus: () => handlers.focus() };
      }

      it('is hidden, with its group, while the panel offers nothing', () => {
        const vm = editorViewModel();
        document.body.innerHTML = CANVAS;
        const { group, button } = renderButton(
          vm,
          document.getElementById('ko_textBlock_3_titleText')
        );
        expect(group.visible).toHaveBeenLastCalledWith(false);
        expect(button.visible).not.toHaveBeenCalled();
      });

      it('shows once the panel exists, named after what it opens', () => {
        const vm = editorViewModel();
        document.body.innerHTML = CANVAS;
        const { settings, group, button, focus } = renderButton(
          vm,
          document.getElementById('ko_textBlock_3_titleText')
        );
        expect(settings.tooltip).toBe('ai-panel-title');

        document.body.insertAdjacentHTML(
          'beforeend',
          '<div id="ai-panel"><ai-panel-plugin></ai-panel-plugin></div>'
        );
        aiPanelPlugin.init(vm);
        focus();

        expect(group.visible).toHaveBeenLastCalledWith(true);
        expect(settings.tooltip).toBe('ai-field-correct-label');
        expect(button.aria).toHaveBeenLastCalledWith(
          'label',
          'ai-field-correct-label'
        );
      });

      it('opens what the element offers', () => {
        const vm = editorViewModel();
        vm.openAiOnElement = jest.fn();
        document.body.innerHTML = CANVAS;
        const element = document.getElementById('custom');
        const { settings } = renderButton(vm, element);
        settings.onclick();
        expect(vm.openAiOnElement).toHaveBeenCalledWith(element);
      });
    });
  });

  describe('the text editor options', () => {
    it('put the AI button first, alone in its group', () => {
      expect(
        withAiActions({ plugins: 'link lists', toolbar1: 'bold italic' })
      ).toEqual({
        plugins: ['link lists aiactions'],
        toolbar1: 'aiactions | bold italic',
      });
    });

    it('accept plugins as an array, or none', () => {
      expect(withAiActions({ plugins: ['link', 'lists'] }).plugins).toEqual([
        'link lists aiactions',
      ]);
      expect(withAiActions({})).toEqual({
        plugins: ['aiactions'],
        toolbar1: 'aiactions',
      });
    });

    it('leave the options they are given as they are', () => {
      const options = { plugins: 'link', toolbar1: 'bold', inline: true };
      const copy = { ...options };
      expect(withAiActions(options).inline).toBe(true);
      expect(options).toEqual(copy);
    });
  });
});
