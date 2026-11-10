/**
 * @jest-environment jsdom
 */
'use strict';

// Archiving what a feature uses (ADR 0019): the dialog says which features
// stop using it; a skill a feature calls is archived only once that is
// confirmed explicitly, and the page says what the archive warns of.

const Vue = require('vue');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const mixinAiVersionedItem = require('../../../packages/ui/helpers/mixins/mixin-ai-versioned-item.js')
  .default;
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const FILE = 'packages/ui/components/ai-skill/bs-ai-archive-modal.vue';
const USED_BY = [
  { featureType: 'subject_generation', description: 'Subject line generation' },
];

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

function mountModal({
  usedBy = USED_BY,
  confirmUsedBy = false,
  locale = 'fr',
}) {
  const vm = mountSfc(FILE, {
    props: { title: 'Archive', body: 'Sure?', usedBy, confirmUsedBy },
    mocks: wordsOf({ fr, en }[locale]),
    imports: { '~/components/modal-confirm.vue': modalStub },
  });
  vm.open();
  return vm;
}

// Vuetify's buttons stay unknown elements: their click is the DOM's.
const archiveButton = (vm) => [...vm.$el.querySelectorAll('v-btn')].pop();
const usedByAlert = (vm) => vm.$el.querySelector('.bs-ai-archive-used-by');

describe('archiving what a feature uses', () => {
  it.each([
    ['fr', /Utilisé par : Subject line generation\. Archivé/],
    ['en', /Used by: Subject line generation\. Archived/],
  ])('says in %s which features stop using it', async (locale, words) => {
    const vm = mountModal({ locale });
    await settle(vm);

    expect(usedByAlert(vm).textContent).toMatch(words);
  });

  it('archives a skill a feature calls only once that is confirmed', async () => {
    const vm = mountModal({ confirmUsedBy: true });
    const confirm = jest.fn();
    vm.$on('confirm', confirm);
    await settle(vm);

    expect(archiveButton(vm).hasAttribute('disabled')).toBe(true);
    vm.$el.querySelector('.v-checkbox-stub').click();
    await settle(vm);
    expect(archiveButton(vm).hasAttribute('disabled')).toBe(false);

    archiveButton(vm).click();
    expect(confirm).toHaveBeenCalledWith({ confirmUsedBy: true });
  });

  it('asks nothing more of what no feature uses', async () => {
    const vm = mountModal({ usedBy: [], confirmUsedBy: true });
    const confirm = jest.fn();
    vm.$on('confirm', confirm);
    await settle(vm);

    expect(usedByAlert(vm)).toBeNull();
    archiveButton(vm).click();
    expect(confirm).toHaveBeenCalledWith({ confirmUsedBy: false });
  });

  it('sends the confirmation, and says what the archive warns of', async () => {
    const archived = {
      skillId: 'redaction.subject-ideas',
      status: 'ARCHIVED',
      usedBy: [],
      warnings: [
        {
          code: 'USED_BY_FEATURES_LOST',
          features: ['Subject line generation'],
        },
      ],
    };
    const $post = jest.fn().mockResolvedValue(archived);
    const commit = jest.fn();
    const vm = new Vue({
      mixins: [
        mixinAiVersionedItem({
          key: 'skill',
          idField: 'skillId',
          routes: { archive: (id) => `/ai-skills/${id}/archive` },
          archivedKey: 'aiSkills.skill.archived',
        }),
      ],
      data: () => ({
        skill: { skillId: 'redaction.subject-ideas', status: 'ACTIVE' },
        usedBy: USED_BY,
        saving: false,
      }),
      beforeCreate() {
        this.$store = {
          commit,
          _modulesNamespaceMap: { 'page/': { context: { commit } } },
        };
        Object.assign(this, wordsOf(fr), { $axios: { $post } });
        this.$refs = {};
      },
    });
    vm.$refs.archiveModal = { close: jest.fn() };

    await vm.archive({ confirmUsedBy: true });

    expect($post).toHaveBeenCalledWith(
      '/ai-skills/redaction.subject-ideas/archive',
      {
        confirmUsedBy: true,
      }
    );
    expect(vm.usedBy).toEqual([]);
    expect(commit.mock.calls[0][1]).toMatchObject({
      text: expect.stringMatching(
        /Ne l'utilisent plus : Subject line generation\./
      ),
      color: 'warning',
    });
  });
});
