/**
 * @jest-environment jsdom
 */
'use strict';

// On a copy, publishing an item that follows production (ADR 0019): the
// dialog offers "Keep on this copy", ticked at first, says in one sentence
// what the box does, and sends `keepOnCopy`. Elsewhere it sends nothing of it.

const Vue = require('vue');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const audienceChange = require('~/helpers/ai-skill-audience-change.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const FILE = 'packages/ui/components/ai-skill/bs-ai-activate-modal.vue';
const LOCALES = { fr, en };

// What Vuetify's checkbox does: its `change` carries the new value.
Vue.component('VCheckbox', {
  props: { inputValue: Boolean, label: { type: String, default: '' } },
  render(h) {
    return h(
      'button',
      {
        class: 'v-checkbox-stub',
        attrs: { 'aria-checked': String(this.inputValue) },
        on: { click: () => this.$emit('change', !this.inputValue) },
      },
      this.label
    );
  },
});

const modalStub = {
  methods: { open() {}, close() {} },
  render(h) {
    return h('div', this.$slots.default);
  },
};

afterEach(() => {
  document.body.innerHTML = '';
});

function mountModal({ locale = 'fr', offerKeepOnCopy = true } = {}) {
  const vm = mountSfc(FILE, {
    props: { offerKeepOnCopy, isMajor: false },
    mocks: wordsOf(LOCALES[locale]),
    imports: {
      'lucide-vue': {},
      '~/components/modal-confirm.vue': modalStub,
      '~/components/form/bs-textarea.vue': {},
      '~/components/ai-skill/bs-ai-open-expertises-choice.vue': {},
      '~/helpers/ai-skill-audience-change.js': audienceChange,
    },
  });
  vm.open({ changelog: 'c', releaseNotes: 'r' });
  return vm;
}

const keepBox = (vm) =>
  vm.$el.querySelector('.bs-ai-activate-keep .v-checkbox-stub');
const explain = (vm) =>
  vm.$el.querySelector('.bs-ai-activate-keep__explain').textContent.trim();

describe('publishing on a copy an item that follows production', () => {
  it.each([
    ['fr', 'Garder sur cette copie', /ne touchera plus cet élément/],
    ['en', 'Keep on this copy', /will no longer touch this item/],
  ])(
    'offers to keep it on the copy, ticked at first, in %s',
    async (locale, label, words) => {
      const vm = mountModal({ locale });
      await settle(vm);

      expect(keepBox(vm).textContent).toBe(label);
      expect(keepBox(vm).getAttribute('aria-checked')).toBe('true');
      expect(explain(vm)).toMatch(words);
    }
  );

  it('sends that it is kept', async () => {
    const vm = mountModal();
    const confirm = jest.fn();
    vm.$on('confirm', confirm);
    await settle(vm);

    vm.onSubmit();
    expect(confirm.mock.calls[0][0]).toMatchObject({ keepOnCopy: true });
  });

  it.each([
    ['fr', /suit toujours la production/],
    ['en', /still follows production/],
  ])(
    'sends that it still follows production once unticked, and says what that does, in %s',
    async (locale, words) => {
      const vm = mountModal({ locale });
      const confirm = jest.fn();
      vm.$on('confirm', confirm);
      await settle(vm);

      keepBox(vm).click();
      await settle(vm);
      expect(explain(vm)).toMatch(words);

      vm.onSubmit();
      expect(confirm.mock.calls[0][0]).toMatchObject({ keepOnCopy: false });
    }
  );

  it('ticks the box again for the next publication', async () => {
    const vm = mountModal();
    await settle(vm);
    keepBox(vm).click();
    await settle(vm);

    vm.open({});
    await settle(vm);
    expect(keepBox(vm).getAttribute('aria-checked')).toBe('true');
  });

  it('says nothing of it elsewhere', async () => {
    const vm = mountModal({ offerKeepOnCopy: false });
    const confirm = jest.fn();
    vm.$on('confirm', confirm);
    await settle(vm);

    expect(vm.$el.querySelector('.bs-ai-activate-keep')).toBeNull();
    vm.onSubmit();
    expect(confirm.mock.calls[0][0]).not.toHaveProperty('keepOnCopy');
  });
});
