/**
 * @jest-environment jsdom
 */
'use strict';

// Whether the logs of a company's AI invocations keep their content, mounted:
// the switch shows what is saved, is saved on its own, and says beside it
// what is logged either way and what it adds.

const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const mixinGroupSwitch = require('../../../packages/ui/helpers/mixins/mixin-group-switch.js');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

// Stands in for the header switch: a click asks for the other value.
const FeatureSwitch = {
  name: 'BsGroupFeatureSwitch',
  props: { value: { type: Boolean, default: false } },
  render(h) {
    return h('button', {
      class: 'feature-switch',
      attrs: { 'aria-pressed': String(this.value) },
      on: { click: () => this.$emit('change', !this.value) },
    });
  },
};

function mountOption(group, $put = jest.fn()) {
  return mountSfc('packages/ui/components/group/ai-log-content-option.vue', {
    props: { group },
    mocks: { $t: (key) => key, $axios: { $put } },
    imports: {
      'lucide-vue': {},
      '~/helpers/mixins/mixin-group-switch.js': mixinGroupSwitch,
      // Rendered, for its header and its tile.
      '~/components/layout/bs-form-section.vue': componentOf(
        'packages/ui/components/layout/bs-form-section.vue'
      ),
      '~/components/group/feature-switch.vue': FeatureSwitch,
      '~/components/layout/bs-save-outcome.vue': {},
    },
  });
}

const switchOf = (vm) => vm.$el.querySelector('.feature-switch');

describe('the content of the AI invocation logs of a company', () => {
  it('shows the switch on, its tile tinted, while the content is kept', async () => {
    const vm = mountOption({ id: 'g1', logSkillInvocationContent: true });
    await settle(vm);

    expect(switchOf(vm).getAttribute('aria-pressed')).toBe('true');
    expect(vm.$el.classList).not.toContain('bs-form-section--idle');
  });

  it('saves the switch turned off on its own, and tells the page', async () => {
    const saved = { id: 'g1', logSkillInvocationContent: false };
    const $put = jest.fn().mockResolvedValue(saved);
    const vm = mountOption({ id: 'g1', logSkillInvocationContent: true }, $put);
    const update = jest.fn();
    vm.$on('update', update);

    switchOf(vm).click();
    await settle(vm);

    expect($put).toHaveBeenCalledWith(expect.any(String), {
      logSkillInvocationContent: false,
    });
    expect(update).toHaveBeenCalledWith(saved);
    expect(
      vm.$el.querySelector('bs-save-outcome').getAttribute('outcome')
    ).toBe('saved');
  });

  it('goes back to what is saved when the save fails', async () => {
    const $put = jest.fn().mockRejectedValue(new Error('500'));
    const vm = mountOption({ id: 'g1', logSkillInvocationContent: true }, $put);

    switchOf(vm).click();
    await settle(vm);

    expect(switchOf(vm).getAttribute('aria-pressed')).toBe('true');
    expect(
      vm.$el.querySelector('bs-save-outcome').getAttribute('outcome')
    ).toBe('failed');
  });

  it.each([
    ['fr', fr, /texte envoyé.*consigne.*réponse brute/, /modèle.*tokens/],
    ['en', en, /text sent.*instruction.*raw answer/, /model.*tokens/],
  ])(
    'says in %s what the content is, and what is logged either way',
    (_lang, messages, content, metadata) => {
      const said = messages.aiFeatures.logContent;
      expect(said.content).toMatch(content);
      expect(said.alwaysLogged).toMatch(metadata);
      expect(said.nextCalls).toBeTruthy();
    }
  );
});
