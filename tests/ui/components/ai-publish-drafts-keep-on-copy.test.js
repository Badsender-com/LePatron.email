/**
 * @jest-environment jsdom
 */
'use strict';

// On a copy, publishing several drafts at once (ADR 0019): the batch dialog
// offers "Keep on this copy", ticked at first, for the whole batch, as the
// publication of one version does, and sends it. Elsewhere it sends nothing
// of it.

const Vue = require('vue');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const publishDrafts = require('~/helpers/publish-drafts.js');
const publicationGuard = require('~/helpers/publication-guard.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const FILE = 'packages/ui/components/ai-skill/bs-ai-publish-drafts.vue';
const LOCALES = { fr, en };
const ITEMS = [{ kind: 'expertise', id: 'deliverability.spam-words' }];
const PLAN = {
  targets: [
    {
      kind: 'expertise',
      id: 'deliverability.spam-words',
      version: { major: 1, minor: 1 },
      updatedAt: '2026-11-04T10:00:00.000Z',
    },
  ],
  skipped: [],
  usedBy: [],
  calls: 0,
  maxCalls: 60,
  notReplayed: 0,
  missing: [],
};

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

async function openDialog({ locale = 'fr', isCopy = true } = {}) {
  const $post = jest.fn(async (url) =>
    url.endsWith('/plan') ? PLAN : { published: [], failed: [], skipped: [] }
  );
  const vm = mountSfc(FILE, {
    props: { items: ITEMS, isCopy },
    mocks: { ...wordsOf(LOCALES[locale]), $axios: { $post } },
    imports: {
      vuex: { mapMutations: () => ({ showSnackbar() {} }) },
      'lucide-vue': {},
      '~/components/modal-confirm.vue': modalStub,
      '~/components/ai-skill/bs-ai-guard-cases.vue': {},
      '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
      '~/helpers/ai-skill-routes.js': {
        aiSkillsPublications: (action) =>
          action
            ? `/ai-skills/publications/${action}`
            : '/ai-skills/publications',
      },
      '~/helpers/ai-skill-errors.js': {
        skillErrorMessage: () => '',
        skillWarningMessage: () => '',
      },
      '~/helpers/publication-guard.js': publicationGuard,
      '~/helpers/publish-drafts.js': publishDrafts,
    },
  });
  await vm.open();
  await settle(vm);
  return { vm, $post };
}

const keepBox = (vm) =>
  vm.$el.querySelector('.bs-ai-publish-keep .v-checkbox-stub');
const explain = (vm) =>
  vm.$el.querySelector('.bs-ai-publish-keep__explain').textContent.trim();
const sent = ($post) => $post.mock.calls[$post.mock.calls.length - 1][1];

describe('publishing several drafts on a copy', () => {
  it.each([
    ['fr', 'Garder sur cette copie', /ne touchera plus les éléments publiés/],
    ['en', 'Keep on this copy', /will no longer touch the items published/],
  ])(
    'offers to keep the batch on the copy, ticked at first, in %s',
    async (locale, label, words) => {
      const { vm } = await openDialog({ locale });

      expect(keepBox(vm).textContent).toBe(label);
      expect(keepBox(vm).getAttribute('aria-checked')).toBe('true');
      expect(explain(vm)).toMatch(words);
    }
  );

  it('sends that the batch is kept', async () => {
    const { vm, $post } = await openDialog();

    await vm.publish();

    expect(sent($post)).toMatchObject({ keepOnCopy: true });
  });

  it.each([
    ['fr', /chaque élément suivi suit toujours la production/],
    ['en', /each followed item still follows production/],
  ])(
    'sends that the batch follows production once unticked, and says what that does, in %s',
    async (locale, words) => {
      const { vm, $post } = await openDialog({ locale });

      keepBox(vm).click();
      await settle(vm);
      expect(explain(vm)).toMatch(words);

      await vm.publish();
      expect(sent($post)).toMatchObject({ keepOnCopy: false });
    }
  );

  it('says nothing of it elsewhere', async () => {
    const { vm, $post } = await openDialog({ isCopy: false });

    expect(vm.$el.querySelector('.bs-ai-publish-keep')).toBeNull();
    await vm.publish();
    expect(sent($post)).not.toHaveProperty('keepOnCopy');
  });
});
