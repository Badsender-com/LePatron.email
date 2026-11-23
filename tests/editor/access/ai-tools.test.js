/**
 * @jest-environment jsdom
 */

'use strict';

// The AI tools of the editor, for each role: shown to whoever the text
// generation routes accept (`mailing.edit-content`, ADR 0016,
// docs/plans/rbac-refonte.md §3.6), hidden from the others rather than
// answered with a refusal. One condition for the « Outils IA » button, the
// panel and the field icons (ext/ai-panel/text-generation-access.js).

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

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const axios = require('axios');
const Vue = require('vue/dist/vue.common');

global.ko = ko;
Vue.config.productionTip = false;
Vue.config.devtools = false;

const currentUserPlugin = require('../../../packages/editor/src/js/ext/badsender-current-user.js');
const aiPanelPlugin = require('../../../packages/editor/src/js/vue/aiPanelPlugin.js');
const {
  createEditorAccess,
} = require('../../../packages/editor/src/js/ext/ai-panel/editor-access.js');
const {
  placeFieldIcons,
} = require('../../../packages/editor/src/js/ext/ai-panel/field-icons.js');
const {
  ROLES,
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');

const MAIN = fs.readFileSync(
  path.join(__dirname, '../../../packages/editor/src/tmpl/main.tmpl.html'),
  'utf8'
);
// The « Outils IA » button of the top bar, with the condition around it.
const AI_BUTTON = /<!-- ko if: typeof \$root\.canUseTextGeneration[\s\S]*?<!-- \/ko -->/.exec(
  MAIN
)[0];

const FIELDS = `
  <div id="main-toolbox">
    <div class="email-metadata__field">
      <div class="email-metadata__label-row"><label for="email-metadata-subject">Objet</label></div>
      <input id="email-metadata-subject" type="text">
    </div>
    <div class="propEditor">
      <span class="propLabel"><span>Preheader</span></span>
      <div class="propInput"><input type="text" data-bind="value: preheaderText"></div>
    </div>
  </div>`;

const ALLOWED = {
  [ROLES.SUPER_ADMIN]: true,
  [ROLES.GROUP_ADMIN_TECH]: true,
  [ROLES.GROUP_ADMIN]: true,
  [ROLES.REGULAR_USER]: true,
  [ROLES.WRITER]: true,
  [ROLES.REVIEWER]: false,
};

/**
 * An editor started as the template loader does: every plugin's `viewModel`,
 * the bindings, then every `init`; the current user arrives afterwards.
 */
function startEditor({ feature = true, canWrite } = {}) {
  let arrive;
  axios.get.mockReturnValue(
    new Promise((resolve) => {
      arrive = (role) => resolve({ data: userOf(role) });
    })
  );
  const metadata = {
    id: 'm1',
    groupId: 'g1',
    hasTextGenerationFeature: feature,
    textGenerationSkills: feature
      ? ['redaction.objet', 'redaction.pre-header', 'redaction.correction']
      : [],
    canWrite,
  };
  const vm = {
    metadata,
    t: (key) => key,
    selectedBlock: ko.observable(null),
    content: () => ({ preheaderText: 'Préheader' }),
    emailMetadataStore: {
      isActive: () => true,
      snapshot: () => ({ subject: 'Objet' }),
    },
  };
  currentUserPlugin({ metadata }).viewModel(vm);
  aiPanelPlugin.viewModel(vm);

  document.body.innerHTML = `
    <div id="top-bar">${AI_BUTTON}</div>
    ${FIELDS}
    <div id="ai-panel"><ai-panel-plugin></ai-panel-plugin></div>`;
  ko.applyBindings(vm, document.getElementById('top-bar'));
  aiPanelPlugin.init(vm);

  return {
    vm,
    arrive: async (role) => {
      arrive(role);
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

const userOf = (role) => ({
  role,
  capabilities: capabilitiesOfRole(role),
  group: { id: 'g1' },
});

const button = () => document.getElementById('ai-toggle');
const fieldIcons = () =>
  [...document.querySelectorAll('[data-ai-target]')].map(
    (icon) => icon.dataset.aiTarget
  );

beforeEach(() => {
  global.mockMountedPanels = [];
  jest.clearAllMocks();
});

afterEach(() => {
  aiPanelPlugin.dispose();
  ko.cleanNode(document.body);
  document.body.innerHTML = '';
});

describe('the AI tools of the editor', () => {
  it('covers every role of the product', () => {
    expect(Object.keys(ALLOWED).sort()).toEqual(
      Object.values(ROLES).slice().sort()
    );
  });

  it.each(Object.entries(ALLOWED))(
    'for a %s, allowed %s: the button, the panel and the field icons alike',
    async (role, allowed) => {
      const { vm, arrive } = startEditor();
      await arrive(role);

      expect(vm.canUseTextGeneration()).toBe(allowed);
      expect(Boolean(button())).toBe(allowed);
      expect(global.mockMountedPanels).toHaveLength(allowed ? 1 : 0);
      expect(createEditorAccess(vm).context().textGeneration).toBe(allowed);

      // The icons are placed from the panel's offer, as the panel does.
      if (allowed) {
        const [panel] = global.mockMountedPanels;
        placeFieldIcons(document.getElementById('main-toolbox'), {
          actionsFor: panel.offerNow(),
          onOpen: panel.openTarget,
        });
        expect(fieldIcons()).toEqual(['subject', 'preheader']);
      }
    }
  );

  it('offers no field icon to a reviewer, nor opens an action from one', async () => {
    const { vm, arrive } = startEditor();
    await arrive(ROLES.REVIEWER);
    // The registry's context alone, as a panel would read it.
    const {
      createAiPanel,
    } = require('../../../packages/editor/src/js/ext/ai-panel/ai-panel-controller.js');
    const isOpen = ko.observable(false);
    const panel = createAiPanel({
      ko,
      editor: createEditorAccess(vm),
      api: { generate: jest.fn() },
      isOpen,
      selection: ko.observable(null),
    });

    placeFieldIcons(document.getElementById('main-toolbox'), {
      actionsFor: panel.offerNow(),
      onOpen: panel.openTarget,
    });
    panel.openTarget({ kind: 'subject' });

    expect(fieldIcons()).toEqual([]);
    expect(isOpen()).toBe(false);
    expect(panel.session()).toBeNull();
    panel.dispose();
  });

  it('shows nothing until the current user is known, then what the role allows', async () => {
    const { vm, arrive } = startEditor();

    expect(vm.canUseTextGeneration()).toBe(false);
    expect(button()).toBeNull();
    expect(global.mockMountedPanels).toHaveLength(0);

    await arrive(ROLES.WRITER);

    expect(button()).not.toBeNull();
    expect(global.mockMountedPanels).toHaveLength(1);
  });

  it('shows nothing to any role when the company has the feature off', async () => {
    const { vm, arrive } = startEditor({ feature: false });
    await arrive(ROLES.SUPER_ADMIN);

    expect(vm.canUseTextGeneration()).toBe(false);
    expect(button()).toBeNull();
    expect(global.mockMountedPanels).toHaveLength(0);
  });

  it('shows nothing where the user may only read the email', async () => {
    const { vm, arrive } = startEditor({ canWrite: false });
    await arrive(ROLES.REGULAR_USER);

    expect(vm.canUseTextGeneration()).toBe(false);
    expect(button()).toBeNull();
    expect(global.mockMountedPanels).toHaveLength(0);
  });

  it('mounts nothing for an editor swapped out before its user arrived', async () => {
    const { arrive } = startEditor();
    aiPanelPlugin.dispose();
    await arrive(ROLES.REGULAR_USER);

    expect(global.mockMountedPanels).toHaveLength(0);
  });
});
