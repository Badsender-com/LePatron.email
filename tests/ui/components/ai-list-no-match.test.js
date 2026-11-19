/**
 * @jest-environment jsdom
 */
'use strict';

// A list of skills or expertises that its filters leave empty says that
// nothing matches them, not that nothing exists. Mounted with the server
// simulated, in French and in English.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const routes = require('~/helpers/ai-skill-routes.js');
const errors = require('~/helpers/ai-skill-errors.js');
const categories = require('~/helpers/ai-skill-categories.js');
const usedByFeature = require('~/helpers/used-by-feature.js');
const publishDrafts = require('~/helpers/publish-drafts.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const LOCALES = { fr, en };

// The table's empty state, as the data table shows it when it has no row.
const tableStub = {
  props: { items: { type: Array, default: () => [] } },
  render(h) {
    return h(
      'div',
      this.items.length
        ? this.items.map((item) => h('div', { class: 'row' }, item.title))
        : this.$scopedSlots['no-data']()
    );
  },
};

afterEach(() => {
  document.body.innerHTML = '';
});

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe.each([
  [
    'skill',
    'packages/ui/components/ai-skill/bs-ai-skills-tab.vue',
    'skillId',
    (words) => words.aiSkills.skill.noSkills,
  ],
  [
    'expertise',
    'packages/ui/components/ai-skill/bs-ai-expertise-tab.vue',
    'expertiseId',
    (words) => words.aiSkills.expertise.noExpertise,
  ],
])('the empty list of the %s items', (kind, file, idField, noneOf) => {
  const ITEM = { [idField]: 'a', title: 'A', status: 'ACTIVE' };

  function mountList(locale, items) {
    return mountSfc(file, {
      mocks: {
        ...wordsOf(LOCALES[locale]),
        $axios: { $get: jest.fn().mockResolvedValue({ items }) },
      },
      imports: {
        vuex: { mapMutations: () => ({ showSnackbar() {} }) },
        'lucide-vue': {},
        '~/helpers/ai-skill-errors.js': errors,
        '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
        '~/helpers/ai-skill-routes.js': routes,
        '~/components/data-table/bs-data-table.vue': tableStub,
        '~/components/ai-skill/bs-ai-skill-create-modal.vue': {},
        '~/components/ai-skill/bs-ai-expertise-create-modal.vue': {},
        '~/components/bs-timestamp.vue': {},
        '~/components/ai-skill/bs-ai-platform-only-chip.vue': {},
        '~/components/ai-skill/bs-ai-skills-export-bar.vue': {},
        '~/components/ai-skill/bs-ai-copy-origin-chip.vue': {},
        '~/helpers/skills-export-download.js': { isExportable: () => true },
        '~/helpers/ai-skill-categories.js': categories,
        '~/helpers/used-by-feature.js': usedByFeature,
        '~/helpers/publish-drafts.js': publishDrafts,
        '~/components/ai-skill/bs-ai-publish-drafts.vue': {},
      },
    });
  }

  it.each([
    ['fr', 'Aucun élément ne correspond aux filtres.'],
    ['en', 'No item matches the filters.'],
  ])(
    'says nothing matches the "used by a feature" filter, in %s',
    async (locale, words) => {
      const vm = mountList(locale, []);
      vm.onlyUsedByFeature = true;
      await settle(vm);

      expect(text(vm.$el)).toContain(words);
      expect(text(vm.$el)).not.toContain(noneOf(LOCALES[locale]));
    }
  );

  it('says nothing matches a search that leaves no row', async () => {
    const vm = mountList('fr', [ITEM]);
    await settle(vm);
    vm.search = 'zzz';
    await settle(vm);

    expect(text(vm.$el)).toContain('Aucun élément ne correspond aux filtres.');
  });

  it.each(['fr', 'en'])(
    'says nothing exists when no filter is set, in %s',
    async (locale) => {
      const vm = mountList(locale, []);
      await settle(vm);

      expect(text(vm.$el)).toContain(noneOf(LOCALES[locale]));
    }
  );
});
