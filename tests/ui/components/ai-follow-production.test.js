/**
 * @jest-environment jsdom
 */
'use strict';

// A copy following production (ADR 0019), mounted with the server simulated,
// in French and in English: whether the night follows it here, the follow
// running now, a follow that failed for some items, and what the report says
// item by item, each failure in the application's words.

const Vue = require('vue');
const vuex = require('vuex');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const routes = require('~/helpers/ai-skill-routes.js');
const errors = require('~/helpers/ai-skill-errors.js');
const skillsFollow = require('~/helpers/skills-follow.js');
const skillsCopy = require('~/helpers/skills-copy.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const FILE = 'packages/ui/components/ai-skill/bs-ai-follow-production.vue';
const LOCALES = { fr, en };

Vue.filter('preciseDateTime', (value) => `[${value}]`);
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
  jest.restoreAllMocks();
});

const ANSWER = {
  isCopy: true,
  configured: true,
  production: 'https://production.example',
  nightly: { enabled: true },
  last: null,
};

function mountFollow({ locale = 'fr', answer = ANSWER, post } = {}) {
  const $axios = {
    $get: jest.fn().mockResolvedValue(answer),
    $post: post || jest.fn(),
  };
  const vm = mountSfc(FILE, {
    mocks: { $axios, $i18n: { locale }, ...wordsOf(LOCALES[locale]) },
    imports: {
      vuex,
      'lucide-vue': {},
      '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
      '~/helpers/ai-skill-routes.js': routes,
      '~/helpers/ai-skill-errors.js': errors,
      '~/helpers/skills-follow.js': skillsFollow,
      '~/helpers/skills-copy.js': skillsCopy,
    },
  });
  return { vm, $axios };
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const texts = (vm, selector) =>
  [...vm.$el.querySelectorAll(selector)].map(text);
const followButton = (vm) => vm.$el.querySelector('.bs-ai-follow__now');

const REPORT = {
  status: 'partial',
  created: [
    {
      kind: 'skill',
      id: 'qc.review',
      version: '1.0',
      warnings: [{ code: 'missing_expertises', expertiseIds: ['tone'] }],
    },
  ],
  updated: [],
  upToDate: [],
  moved: [{ kind: 'skill', id: 'redaction', copyId: 'redaction.copie' }],
  removed: [{ kind: 'expertise', id: 'old' }],
  kept: [
    {
      kind: 'expertise',
      id: 'brand',
      reason: 'kept_on_copy',
      productionChanged: true,
    },
  ],
  failed: [{ kind: 'skill', id: 'broken', version: '2.0', message: 'E' }],
};
const LAST = {
  status: 'partial',
  trigger: 'manual',
  by: 'Alice',
  at: '2026-11-10T08:00:00Z',
  created: 1,
  updated: 0,
  upToDate: 0,
  moved: 1,
  removed: 1,
  kept: 1,
  failed: 1,
  failures: [
    {
      kind: 'skill',
      id: 'broken',
      message: 'Validation failed: versions.0.inputSchemaId',
    },
  ],
};

describe('the follow of production on a copy', () => {
  it('tells the tab it is a copy', async () => {
    const { vm } = mountFollow();
    const state = jest.fn();
    vm.$on('state', state);
    await settle(vm);
    expect(state).toHaveBeenCalledWith({
      isCopy: true,
      nightly: true,
      lock: null,
    });
  });

  it.each([
    ['fr', true, 'Le suivi de nuit est actif sur cette instance.'],
    ['fr', false, "Le suivi de nuit n'est pas actif sur cette instance"],
    ['en', true, 'The nightly follow is on for this instance.'],
    ['en', false, 'The nightly follow is off for this instance'],
  ])(
    'says in %s whether the night follows it here (%s)',
    async (locale, enabled, words) => {
      const { vm } = mountFollow({
        locale,
        answer: { ...ANSWER, nightly: { enabled } },
      });
      await settle(vm);
      expect(text(vm.$el.querySelector('.bs-ai-follow__nightly'))).toContain(
        words
      );
    }
  );

  it.each([
    [
      'fr',
      'Un suivi est en cours depuis le [2026-11-10T07:59:00Z], lancé par Alice.',
    ],
    [
      'en',
      'A follow has been running since [2026-11-10T07:59:00Z], started by Alice.',
    ],
  ])(
    'says in %s that a follow is running, and waits for it',
    async (locale, words) => {
      const { vm } = mountFollow({
        locale,
        answer: {
          ...ANSWER,
          lock: {
            trigger: 'manual',
            by: 'Alice',
            startedAt: '2026-11-10T07:59:00Z',
          },
        },
      });
      await settle(vm);
      expect(text(vm.$el.querySelector('.bs-ai-follow__lock'))).toBe(words);
      expect(followButton(vm).hasAttribute('disabled')).toBe(true);
    }
  );

  it.each([
    ['fr', 'Production suivie en partie : certains éléments sont en échec.'],
    ['en', 'Production partly followed: some items failed.'],
  ])(
    'says in %s, in the warning color, a follow that failed for some items',
    async (locale, words) => {
      const post = jest.fn().mockResolvedValue({ report: REPORT, last: LAST });
      const { vm } = mountFollow({ locale, post });
      const followed = jest.fn();
      vm.$on('followed', followed);
      await settle(vm);

      followButton(vm).dispatchEvent(new Event('click'));
      await settle(vm);

      expect(commit).toHaveBeenCalledWith('SHOW_SNACKBAR', {
        text: words,
        color: 'warning',
      });
      expect(followed).toHaveBeenCalled();
      expect(
        vm.$el.querySelector('.bs-ai-follow__last v-chip').getAttribute('color')
      ).toBe('warning');
    }
  );

  it.each([
    [
      'fr',
      [
        '1 élément ajouté',
        '1 travail de la copie mis de côté',
        '1 élément supprimé',
        '1 élément gardé sur cette copie',
        '1 élément en échec',
      ],
    ],
    [
      'en',
      [
        '1 item added',
        "1 piece of the copy's work set aside",
        '1 item removed',
        '1 item kept on this copy',
        '1 item failed',
      ],
    ],
  ])('counts in %s, one and many', async (locale, words) => {
    const { vm } = mountFollow({ locale, answer: { ...ANSWER, last: LAST } });
    await settle(vm);
    expect(texts(vm, '.bs-ai-follow__outcomes li')).toEqual(words);

    vm.last = { ...LAST, created: 3 };
    await settle(vm);
    expect(text(vm.$el.querySelector('.bs-ai-follow__outcome--created'))).toBe(
      locale === 'fr' ? '3 éléments ajoutés' : '3 items added'
    );
  });

  it('names each item of the report: the work moved with its link, what was kept, removed and to check', async () => {
    const post = jest.fn().mockResolvedValue({ report: REPORT, last: LAST });
    const { vm } = mountFollow({ post });
    await settle(vm);
    followButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    const moved = vm.$el.querySelector('.bs-ai-follow__moved');
    expect(text(moved)).toBe(
      '« redaction » : le travail fait sur la copie est en brouillon dans redaction.copie'
    );
    expect(moved.querySelector('a').getAttribute('href')).toBe(
      '/ai-skills/redaction.copie'
    );
    expect(texts(vm, '.bs-ai-follow__kept')).toEqual([
      'brand — la production a changé',
    ]);
    expect(texts(vm, '.bs-ai-follow__removed')).toEqual(['old']);
    expect(texts(vm, '.bs-ai-follow__warning')).toEqual([
      '« qc.review » consomme des expertises absentes de cette copie : tone.',
    ]);
  });

  it.each([
    ['fr', "broken — Cet élément n'a pas pu être écrit."],
    ['en', 'broken — This item could not be written.'],
  ])(
    'never shows the sentence of the server for a failed item, in %s',
    async (locale, words) => {
      const { vm } = mountFollow({ locale, answer: { ...ANSWER, last: LAST } });
      await settle(vm);
      expect(texts(vm, '.bs-ai-follow__failure')).toEqual([words]);
    }
  );

  it('says a failed item in the words of its code', async () => {
    const { vm } = mountFollow({
      answer: {
        ...ANSWER,
        last: {
          ...LAST,
          failures: [
            { kind: 'skill', id: 'broken', message: 'SKILL_VERSION_CHANGED' },
          ],
        },
      },
    });
    await settle(vm);
    const [failure] = texts(vm, '.bs-ai-follow__failure');
    expect(failure).toBe(
      `broken — ${fr.aiSkills.errors.SKILL_VERSION_CHANGED}`
    );
  });

  it.each([
    ['fr', 'Un suivi est déjà en cours'],
    ['en', 'A follow is already running'],
  ])(
    'says in %s that a follow is already running, and reads the tab again',
    async (locale, words) => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const refused = Object.assign(new Error('409'), {
        response: { status: 409, data: { message: 'SOMETHING_UNKNOWN' } },
      });
      const post = jest.fn().mockRejectedValue(refused);
      const { vm, $axios } = mountFollow({ locale, post });
      await settle(vm);
      followButton(vm).dispatchEvent(new Event('click'));
      await settle(vm);

      const [[, notice]] = commit.mock.calls;
      expect(notice.color).toBe('warning');
      expect(notice.text).toContain(words);
      expect($axios.$get).toHaveBeenCalledTimes(2);
    }
  );
});
