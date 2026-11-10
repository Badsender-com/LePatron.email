/**
 * @jest-environment jsdom
 */
'use strict';

// On a copy, a skill or an expertise says where it comes from, in the lists
// and on its page, and its page offers what the copy does with it (ADR 0019):
// keep it on the copy, follow production again, duplicate one of its
// versions. Mounted with the server simulated, in French and in English;
// nothing of it on production.

const Vue = require('vue');
const vuex = require('vuex');
const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const routes = require('~/helpers/ai-skill-routes.js');
const errors = require('~/helpers/ai-skill-errors.js');
const skillsCopy = require('~/helpers/skills-copy.js');
const skillsFollow = require('~/helpers/skills-follow.js');
const categories = require('~/helpers/ai-skill-categories.js');
const usedByFeature = require('~/helpers/used-by-feature.js');
const publishDrafts = require('~/helpers/publish-drafts.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const LOCALES = { fr, en };
const CHIP = 'packages/ui/components/ai-skill/bs-ai-copy-origin-chip.vue';
const PANEL = 'packages/ui/components/ai-skill/bs-ai-copy-panel.vue';

Vue.component('NuxtLink', {
  props: { to: { type: String, default: '' } },
  render(h) {
    return h('a', { attrs: { href: this.to } }, this.$slots.default);
  },
});

let commit;
beforeEach(() => {
  commit = jest.fn();
  Vue.prototype.$store = {
    commit,
    _modulesNamespaceMap: { 'page/': { context: { commit } } },
  };
});
afterEach(() => {
  document.body.innerHTML = '';
});

const chipImports = {
  '~/helpers/skills-copy.js': skillsCopy,
  '~/helpers/skills-follow.js': skillsFollow,
};
const chip = (locale) => ({
  ...componentOf(CHIP, chipImports),
  // The words of the page that holds it.
  beforeCreate() {
    Object.assign(this, wordsOf(LOCALES[locale]));
  },
});

// A modal the panel opens and closes by its ref, holding its content.
const modalStub = {
  methods: { open() {}, close() {} },
  render(h) {
    return h('div', this.$slots.default);
  },
};

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('the origin of an item of a copy', () => {
  it.each([
    ['fr', { followedAt: 'x' }, 'Suit la production'],
    ['fr', { followedAt: 'x', keptOnCopy: true }, 'Gardé sur cette copie'],
    ['fr', {}, 'Écrit sur cette copie'],
    ['fr', { copiedFrom: 'redaction' }, 'Travail de la copie'],
    ['en', { followedAt: 'x' }, 'Follows production'],
    ['en', { followedAt: 'x', keptOnCopy: true }, 'Kept on this copy'],
    ['en', {}, 'Written on this copy'],
    ['en', { copiedFrom: 'redaction' }, "Copy's work"],
  ])('reads in %s, for %j, %s', (locale, item, words) => {
    const vm = mountSfc(CHIP, {
      props: { kind: 'skill', item, isCopy: true, followedOnce: true },
      mocks: wordsOf(LOCALES[locale]),
      imports: chipImports,
    });
    expect(text(vm.$el.querySelector('v-chip'))).toBe(words);
  });

  it.each([
    ['fr', 'Pas encore suivi', /premier suivi/],
    ['en', 'Not followed yet', /first follow/],
  ])(
    'reads in %s that an item is not followed yet while the copy has followed nothing',
    (locale, words, hint) => {
      const vm = mountSfc(CHIP, {
        props: { kind: 'skill', item: {}, isCopy: true, followedOnce: false },
        mocks: wordsOf(LOCALES[locale]),
        imports: chipImports,
      });
      const badge = vm.$el.querySelector('v-chip');
      expect(text(badge)).toBe(words);
      expect(badge.getAttribute('title')).toMatch(hint);
    }
  );

  it.each([
    ['fr', /sauf si la production a un élément du même identifiant/],
    ['en', /unless production has an item of the same id/],
  ])(
    'says in %s that a follow takes over an item written on the copy when production has its id',
    (locale, hint) => {
      const vm = mountSfc(CHIP, {
        props: { kind: 'skill', item: {}, isCopy: true, followedOnce: true },
        mocks: wordsOf(LOCALES[locale]),
        imports: chipImports,
      });
      expect(vm.$el.querySelector('v-chip').getAttribute('title')).toMatch(
        hint
      );
    }
  );

  it('links the copy’s work to the item it comes from', () => {
    const vm = mountSfc(CHIP, {
      props: {
        kind: 'expertise',
        item: { copiedFrom: 'brand' },
        isCopy: true,
      },
      mocks: wordsOf(fr),
      imports: chipImports,
    });
    const link = vm.$el.querySelector('a');
    expect(link.getAttribute('href')).toBe('/ai-expertise/brand');
    expect(link.getAttribute('aria-label')).toBe(
      "Ouvrir l'élément d'origine « brand »"
    );
  });

  it('says nothing on production', () => {
    const vm = mountSfc(CHIP, {
      props: { kind: 'skill', item: { followedAt: 'x' }, isCopy: false },
      mocks: wordsOf(fr),
      imports: chipImports,
    });
    expect(vm.$el.nodeType).toBe(Node.COMMENT_NODE);
  });
});

// A list with its rows' titles, as the data table renders them.
const tableStub = {
  props: { items: { type: Array, default: () => [] } },
  render(h) {
    return h(
      'div',
      this.items.map((item) =>
        h('div', { class: 'row' }, this.$scopedSlots['item.title']({ item }))
      )
    );
  },
};

describe.each([
  ['skill', 'packages/ui/components/ai-skill/bs-ai-skills-tab.vue', 'skillId'],
  [
    'expertise',
    'packages/ui/components/ai-skill/bs-ai-expertise-tab.vue',
    'expertiseId',
  ],
])('the list of the %s items', (kind, file, idField) => {
  const ITEMS = [
    { [idField]: 'a', title: 'A', audience: 'all', followedAt: 'x' },
    { [idField]: 'b', title: 'B', audience: 'all' },
  ];
  function mountList(isCopy, followedOnce = true) {
    return mountSfc(file, {
      props: { isCopy, followedOnce },
      mocks: {
        ...wordsOf(fr),
        $axios: { $get: jest.fn().mockResolvedValue({ items: ITEMS }) },
      },
      imports: {
        vuex,
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
        '~/components/ai-skill/bs-ai-copy-origin-chip.vue': chip('fr'),
        '~/helpers/skills-export-download.js': { isExportable: () => true },
        '~/helpers/ai-skill-categories.js': categories,
        '~/helpers/used-by-feature.js': usedByFeature,
        '~/helpers/publish-drafts.js': publishDrafts,
        '~/components/ai-skill/bs-ai-publish-drafts.vue': {},
      },
    });
  }

  it('says where each item comes from on a copy', async () => {
    const vm = mountList(true);
    await settle(vm);
    expect([...vm.$el.querySelectorAll('.row v-chip')].map(text)).toEqual([
      'Suit la production',
      'Écrit sur cette copie',
    ]);
  });

  it('says an item written on the copy is not followed yet before the first follow', async () => {
    const vm = mountList(true, false);
    await settle(vm);
    expect([...vm.$el.querySelectorAll('.row v-chip')].map(text)).toEqual([
      'Suit la production',
      'Pas encore suivi',
    ]);
  });

  it('says nothing of it on production', async () => {
    const vm = mountList(false);
    await settle(vm);
    expect(vm.$el.querySelectorAll('.row v-chip')).toHaveLength(0);
  });
});

const SKILL = {
  skillId: 'redaction',
  title: 'Rédaction',
  followedAt: '2026-11-10',
  activeVersion: { major: 1, minor: 1 },
  versions: [
    { versionMajor: 1, versionMinor: 0, status: 'ARCHIVED' },
    { versionMajor: 1, versionMinor: 1, status: 'ACTIVE' },
    { versionMajor: 2, versionMinor: 0, status: 'DRAFT' },
  ],
};

function mountPanel({
  locale = 'fr',
  item = SKILL,
  isCopy = true,
  followedOnce = true,
  kind = 'skill',
} = {}) {
  const $axios = {
    $post: jest.fn((url) =>
      Promise.resolve(
        url.endsWith('/duplicate-on-copy')
          ? { skillId: 'redaction.copie', expertiseId: 'brand.copie' }
          : {}
      )
    ),
    $delete: jest.fn().mockResolvedValue({}),
  };
  const $router = { push: jest.fn() };
  const vm = mountSfc(PANEL, {
    props: { kind, item, isCopy, followedOnce },
    mocks: { $axios, $router, ...wordsOf(LOCALES[locale]) },
    imports: {
      vuex,
      'lucide-vue': {},
      '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
      '~/helpers/ai-skill-routes.js': routes,
      '~/helpers/ai-skill-errors.js': errors,
      '~/helpers/skills-copy.js': skillsCopy,
      '~/helpers/skills-follow.js': skillsFollow,
      '~/components/modal-confirm.vue': modalStub,
      '~/components/modal/bs-modal-form.vue': modalStub,
      '~/components/form/bs-select.vue': {},
      '~/components/ai-skill/bs-ai-copy-origin-chip.vue': chip(locale),
    },
  });
  return { vm, $axios, $router };
}

const buttonOf = (vm, name) =>
  vm.$el.querySelector(`.bs-ai-copy-panel__${name}`);

describe('what a copy does with an item, on its page', () => {
  it.each([
    ['fr', 'Garder sur cette copie', 'Dupliquer sur cette copie'],
    ['en', 'Keep on this copy', 'Duplicate on this copy'],
  ])('keeps a followed item, in %s', async (locale, keep, duplicate) => {
    const { vm, $axios } = mountPanel({ locale });
    const changed = jest.fn();
    vm.$on('changed', changed);

    expect(text(buttonOf(vm, 'keep'))).toBe(keep);
    expect(text(buttonOf(vm, 'duplicate'))).toBe(duplicate);
    expect(buttonOf(vm, 'follow')).toBeNull();

    buttonOf(vm, 'keep').dispatchEvent(new Event('click'));
    await settle(vm);

    expect($axios.$post).toHaveBeenCalledWith(
      '/ai-skills/redaction/keep-on-copy'
    );
    expect(changed).toHaveBeenCalled();
  });

  it.each([
    ['fr', 'Suivre la production', /rien n'est perdu/],
    ['en', 'Follow production', /nothing is lost/],
  ])(
    'follows production again once confirmed, in %s',
    async (locale, follow, confirm) => {
      const { vm, $axios } = mountPanel({
        locale,
        kind: 'expertise',
        item: {
          expertiseId: 'brand',
          keptOnCopy: true,
          versions: SKILL.versions,
        },
      });
      const changed = jest.fn();
      vm.$on('changed', changed);

      expect(text(buttonOf(vm, 'follow'))).toBe(follow);
      expect(buttonOf(vm, 'keep')).toBeNull();
      expect(vm.$el.textContent).toMatch(confirm);

      vm.followProduction();
      await settle(vm);
      expect($axios.$delete).toHaveBeenCalledWith(
        '/ai-expertise/brand/keep-on-copy'
      );
      expect(changed).toHaveBeenCalled();
    }
  );

  it('duplicates the version chosen, the active one at first, and opens the new item', async () => {
    const { vm, $axios, $router } = mountPanel();

    buttonOf(vm, 'duplicate').dispatchEvent(new Event('click'));
    expect(vm.duplicateVersion).toBe('1.1');
    vm.duplicateVersion = '2.0';
    await vm.duplicate();
    await settle(vm);

    expect($axios.$post).toHaveBeenCalledWith(
      '/ai-skills/redaction/duplicate-on-copy',
      {
        version: '2.0',
      }
    );
    expect($router.push).toHaveBeenCalledWith(
      '/ai-skills/redaction.copie?tab=versions'
    );
  });

  it.each([
    [
      'fr',
      'Garder sur cette copie',
      'Le suivi le laisse tel quel, sauf si la production a un élément du même identifiant : il le reprend alors, et le travail de la copie part dans un élément à part, « (travail de la copie) ».',
    ],
    [
      'en',
      'Keep on this copy',
      'The follow leaves it as it is, unless production has an item of the same id: it then takes it over, and the copy\'s work moves to a separate "(travail de la copie)" item.',
    ],
  ])(
    'keeps an item written on the copy too, and says in %s what the follow does to it',
    async (locale, keep, explain) => {
      const { vm, $axios } = mountPanel({
        locale,
        item: { ...SKILL, followedAt: undefined },
      });
      expect(text(vm.$el.querySelector('.bs-ai-copy-panel__explain'))).toBe(
        explain
      );
      expect(text(buttonOf(vm, 'keep'))).toBe(keep);
      expect(buttonOf(vm, 'duplicate')).toBeNull();

      buttonOf(vm, 'keep').dispatchEvent(new Event('click'));
      await settle(vm);
      expect($axios.$post).toHaveBeenCalledWith(
        '/ai-skills/redaction/keep-on-copy'
      );
    }
  );

  it.each([
    ['fr', /n'a pas encore suivi la production/],
    ['en', /has not followed production yet/],
  ])(
    'says in %s that the first follow may take over an item while the copy has followed nothing',
    (locale, explain) => {
      const { vm } = mountPanel({
        locale,
        followedOnce: false,
        item: { ...SKILL, followedAt: undefined },
      });
      expect(text(vm.$el.querySelector('.bs-ai-copy-panel__explain'))).toMatch(
        explain
      );
      expect(buttonOf(vm, 'keep')).toBeTruthy();
    }
  );

  it('follows production again for an item written on the copy and kept there', () => {
    const { vm } = mountPanel({
      item: { ...SKILL, followedAt: undefined, keptOnCopy: true },
    });
    expect(buttonOf(vm, 'follow')).toBeTruthy();
    expect(buttonOf(vm, 'keep')).toBeNull();
  });

  it('is not there on production', () => {
    const { vm } = mountPanel({ isCopy: false });
    expect(vm.$el.nodeType).toBe(Node.COMMENT_NODE);
  });

  it('says why the server refused, in the application’s words', async () => {
    const { vm, $axios } = mountPanel();
    $axios.$post.mockRejectedValueOnce(
      Object.assign(new Error('409'), {
        response: { status: 409, data: { message: 'SKILL_VERSION_CHANGED' } },
      })
    );
    buttonOf(vm, 'keep').dispatchEvent(new Event('click'));
    await settle(vm);
    expect(commit).toHaveBeenCalledWith('SHOW_SNACKBAR', {
      text: fr.aiSkills.errors.SKILL_VERSION_CHANGED,
      color: 'error',
    });
  });
});
