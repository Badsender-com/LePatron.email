/**
 * @jest-environment jsdom
 */
'use strict';

// The AI features of a company, mounted: each is a card whose icon tile is
// tinted while it is on. What is coming is on for no one: its tile is grey.

const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');

function mountTab() {
  const vm = mountSfc('packages/ui/components/group/ai-features-tab.vue', {
    mocks: {
      $t: (key) => key,
      $route: { params: { groupId: 'g1' } },
    },
    imports: {
      // The loading and saving of the AI features, shared with the engine
      // sections: a company with none configured yet.
      '~/helpers/mixins/mixin-ai-feature-config.js': {
        data: () => ({
          loading: false,
          saving: false,
          config: { features: [] },
          integrations: [],
        }),
      },
      '~/components/integrations/provider-configs': {
        getProviderLabel: (provider) => provider,
      },
      '~/helpers/constants/languages.js': { LANGUAGE_OPTIONS: [] },
      '~/components/form/bs-select.vue': {},
      '~/components/group/bs-ai-model-picker.vue': {},
      // Rendered, for its card and its tile.
      '~/components/layout/bs-form-section.vue': componentOf(
        'packages/ui/components/layout/bs-form-section.vue'
      ),
      '~/components/group/BsAiFeatureEngineSection.vue': {},
      '~/components/group/feature-switch.vue': {},
      'lucide-vue': {},
    },
  });
  return vm;
}

const sectionTitled = (vm, title) =>
  [...vm.$el.querySelectorAll('.bs-form-section')].find(
    (section) =>
      section.querySelector('.bs-form-section__title').textContent.trim() ===
      title
  );

describe('the AI features of a company', () => {
  it('show what is coming on a grey tile, as a feature turned off', async () => {
    const vm = mountTab();
    await settle(vm);

    const upcoming = sectionTitled(vm, 'aiFeatures.upcomingFeatures');

    expect(upcoming.classList).toContain('bs-form-section--card');
    expect(upcoming.classList).toContain('bs-form-section--idle');
  });
});

// The tab loads the company's AI configuration and integrations once, and
// hands them to its engine sections: a section loading its own would read
// the same document again, and on a first visit try to create it again.
describe('the AI features tab and its engine sections', () => {
  const Vue = require('vue');
  const mixinAiFeatureConfig = require('../../../packages/ui/helpers/mixins/mixin-ai-feature-config.js');

  const CONFIG = {
    features: [
      { featureType: 'translation', isActive: false },
      { featureType: 'text_generation', isActive: false },
      { featureType: 'skill', isActive: false },
    ],
  };
  const INTEGRATIONS = [
    { _id: 'i1', name: 'Writer', provider: 'openai', canGenerateText: true },
    {
      _id: 'i2',
      name: 'Translator',
      provider: 'deepl',
      canGenerateText: false,
    },
  ];

  const engineSection = () =>
    componentOf('packages/ui/components/group/BsAiFeatureEngineSection.vue', {
      '~/components/integrations/provider-configs': {
        getProviderLabel: (provider) => provider,
      },
      '~/components/form/bs-select.vue': {},
      '~/components/group/bs-ai-model-picker.vue': {},
      '~/components/layout/bs-form-section.vue': componentOf(
        'packages/ui/components/layout/bs-form-section.vue'
      ),
      '~/components/group/feature-switch.vue': {},
      'lucide-vue': {},
    });

  function mountLoadingTab($axios) {
    // The sections are children: they read the translations from Vue.
    Vue.prototype.$t = (key) => key;
    return mountSfc('packages/ui/components/group/ai-features-tab.vue', {
      props: { isPlatform: true },
      mocks: {
        $t: (key) => key,
        $route: { params: { groupId: 'g1' } },
        $axios,
        $store: { commit: jest.fn(), _modulesNamespaceMap: {} },
      },
      imports: {
        '~/helpers/mixins/mixin-ai-feature-config.js': mixinAiFeatureConfig,
        '~/components/integrations/provider-configs': {
          getProviderLabel: (provider) => provider,
        },
        '~/helpers/constants/languages.js': { LANGUAGE_OPTIONS: [] },
        '~/components/form/bs-select.vue': {},
        '~/components/group/bs-ai-model-picker.vue': {},
        '~/components/layout/bs-form-section.vue': componentOf(
          'packages/ui/components/layout/bs-form-section.vue'
        ),
        '~/components/group/BsAiFeatureEngineSection.vue': engineSection(),
        '~/components/group/feature-switch.vue': {},
        'lucide-vue': {},
      },
    });
  }

  const axiosFor = () => ({
    $get: jest.fn((url) =>
      Promise.resolve(
        url.startsWith('/integrations/') ? { items: INTEGRATIONS } : CONFIG
      )
    ),
    $put: jest.fn().mockResolvedValue(CONFIG),
  });

  const sectionsOf = (vm) =>
    vm.$children.filter(
      (child) => child.$options.name === 'BsAiFeatureEngineSection'
    );

  it('loads the configuration once for the tab and both sections', async () => {
    const $axios = axiosFor();
    const vm = mountLoadingTab($axios);
    await settle(vm);

    const configReads = $axios.$get.mock.calls.filter(([url]) =>
      url.startsWith('/ai-features/')
    );
    expect(configReads).toHaveLength(1);
    expect($axios.$get).toHaveBeenCalledTimes(2);
    expect(sectionsOf(vm)).toHaveLength(2);
    sectionsOf(vm).forEach((section) => {
      expect(section.config).toBe(CONFIG);
      expect(section.integrations).toBe(INTEGRATIONS);
    });
  });

  // The server says which provider writes text: a section offers those only.
  it('offers a section the integrations that can generate text', async () => {
    const vm = mountLoadingTab(axiosFor());
    await settle(vm);

    const [textGeneration] = sectionsOf(vm);
    expect(textGeneration.integrationOptions.map((o) => o.value)).toEqual([
      null,
      'i1',
    ]);
  });

  it("saves a section's feature through the tab", async () => {
    const $axios = axiosFor();
    const vm = mountLoadingTab($axios);
    await settle(vm);

    const [textGeneration] = sectionsOf(vm);
    textGeneration.featureIsActive = true;
    await settle(vm);

    expect($axios.$put).toHaveBeenCalledTimes(1);
    expect($axios.$put).toHaveBeenCalledWith(
      '/ai-features/groups/g1/features/text_generation',
      {
        isActive: true,
      }
    );
  });
});
