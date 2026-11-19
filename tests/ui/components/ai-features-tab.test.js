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
