/**
 * @jest-environment jsdom
 */
'use strict';

// Publishing the drafts selected in a list (ADR 0019): the dialog stays on
// its report until the person closes it. Only then does the list clear its
// selection, which holds the dialog on the page, and reload. Mounted with
// the server simulated, the list holding the real dialog.

const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const routes = require('~/helpers/ai-skill-routes.js');
const errors = require('~/helpers/ai-skill-errors.js');
const categories = require('~/helpers/ai-skill-categories.js');
const usedByFeature = require('~/helpers/used-by-feature.js');
const publishDrafts = require('~/helpers/publish-drafts.js');
const publicationGuard = require('~/helpers/publication-guard.js');
const fr = require('~/helpers/locales/fr.js').default;

const DIALOG = 'packages/ui/components/ai-skill/bs-ai-publish-drafts.vue';
const vuexStub = { mapMutations: () => ({ showSnackbar() {} }) };
const pageStore = { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' };

// A modal opened and closed by its ref, holding its content, which says it
// was closed as the real one does.
const modalStub = {
  methods: {
    open() {},
    close() {
      this.$emit('close');
    },
  },
  render(h) {
    return h('div', this.$slots.default);
  },
};

// The table draws nothing of its rows here: the selection is set on the list.
const tableStub = { render: (h) => h('div') };

afterEach(() => {
  document.body.innerHTML = '';
});

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const button = (vm, words) =>
  [...vm.$el.querySelectorAll('v-btn')].find((b) => text(b) === words);

describe.each([
  ['skill', 'packages/ui/components/ai-skill/bs-ai-skills-tab.vue', 'skillId'],
  [
    'expertise',
    'packages/ui/components/ai-skill/bs-ai-expertise-tab.vue',
    'expertiseId',
  ],
])('publishing the %s drafts selected in their list', (kind, file, idField) => {
  const ITEM = { [idField]: 'a', title: 'A', status: 'DRAFT' };
  const PLAN = {
    targets: [{ kind, id: 'a', updatedAt: '2026-11-04T10:00:00.000Z' }],
    skipped: [],
    usedBy: [],
  };
  const REPORT = { published: [{ kind, id: 'a' }], failed: [], skipped: [] };

  async function selectAndPublish() {
    const $axios = {
      $get: jest.fn().mockResolvedValue({ items: [ITEM] }),
      $post: jest.fn(async (url) => (url.endsWith('/plan') ? PLAN : REPORT)),
    };
    const words = wordsOf(fr);
    const dialog = {
      ...componentOf(DIALOG, {
        vuex: vuexStub,
        'lucide-vue': {},
        '~/components/modal-confirm.vue': modalStub,
        '~/components/ai-skill/bs-ai-guard-cases.vue': {},
        '~/store/page.js': pageStore,
        '~/helpers/ai-skill-routes.js': routes,
        '~/helpers/ai-skill-errors.js': errors,
        '~/helpers/publication-guard.js': publicationGuard,
        '~/helpers/publish-drafts.js': publishDrafts,
      }),
      beforeCreate() {
        Object.assign(this, words, { $axios });
      },
    };
    const vm = mountSfc(file, {
      mocks: { ...words, $axios },
      imports: {
        vuex: vuexStub,
        'lucide-vue': {},
        '~/helpers/ai-skill-errors.js': errors,
        '~/store/page.js': pageStore,
        '~/helpers/ai-skill-routes.js': routes,
        '~/components/data-table/bs-data-table.vue': tableStub,
        '~/components/ai-skill/bs-ai-skill-create-modal.vue': {},
        '~/components/ai-skill/bs-ai-expertise-create-modal.vue': {},
        '~/components/bs-timestamp.vue': {},
        '~/components/ai-skill/bs-ai-platform-only-chip.vue': {},
        '~/components/ai-skill/bs-ai-skills-export-bar.vue': {},
        '~/components/ai-skill/bs-ai-copy-origin-chip.vue': {},
        '~/helpers/skills-export-download.js': { isExportable: () => false },
        '~/helpers/ai-skill-categories.js': categories,
        '~/helpers/used-by-feature.js': usedByFeature,
        '~/helpers/publish-drafts.js': publishDrafts,
        '~/components/ai-skill/bs-ai-publish-drafts.vue': dialog,
      },
    });
    await settle(vm);
    vm.selected = [vm.tableItems[0]];
    await settle(vm);

    button(vm, fr.aiSkills.publishDrafts.action).click();
    await settle(vm);
    button(vm, fr.aiSkills.publishDrafts.publish).click();
    await settle(vm);
    return { vm, $axios };
  }

  it('stays on the report, the selection kept, until it is closed', async () => {
    const { vm, $axios } = await selectAndPublish();

    expect(text(vm.$el)).toContain(fr.aiSkills.publishDrafts.report);
    expect(text(vm.$el)).toContain(
      `${fr.aiSkills.publishDrafts.publishedLabel} a`
    );
    expect(vm.selected).toHaveLength(1);
    expect($axios.$get).toHaveBeenCalledTimes(1);
  });

  it('clears the selection and reloads the list once the report is closed', async () => {
    const { vm, $axios } = await selectAndPublish();

    button(vm, fr.aiSkills.publishDrafts.close).click();
    await settle(vm);

    expect(vm.selected).toEqual([]);
    expect(vm.$el.querySelector('.bs-ai-publish-drafts')).toBeNull();
    expect($axios.$get).toHaveBeenCalledTimes(2);
  });
});
