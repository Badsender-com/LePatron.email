/**
 * @jest-environment jsdom
 */
'use strict';

// The import modal of the skills export (ADR 0018), mounted with the server
// simulated: the file, its preview, then the report of the import, each
// announced as it comes, in the application's language.

const Vue = require('vue');
const { get } = require('lodash');
const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const routes = require('~/helpers/ai-skill-routes.js');
const errors = require('~/helpers/ai-skill-errors.js');
const skillsImport = require('~/helpers/skills-import.js');

const FILE = 'packages/ui/components/ai-skill/bs-ai-skills-import-modal.vue';

// What the i18n plugin gives every component: the key, with what fills it.
// A key the test names in `KNOWN` has an entry; vue-i18n echoes any other
// key back.
const KNOWN = { 'aiSkills.errors.SKILL_ID_TAKEN': 'Identifier taken' };
const t = (key, params) => {
  if (key in KNOWN) return KNOWN[key];
  return params && Object.keys(params).length
    ? `${key} ${JSON.stringify(params)}`
    : key;
};
Vue.prototype.$t = t;
Vue.prototype.$tc = (key, count) => `${key} (${count})`;
const en = require('~/helpers/locales/en.js').default;
Vue.prototype.$te = (key) => key in KNOWN || get(en, key) !== undefined;

Vue.component('NuxtLink', {
  props: { to: { type: String, default: '' } },
  render(h) {
    return h('a', { attrs: { href: this.to } }, this.$slots.default);
  },
});

const PREVIEW = {
  origin: 'https://source.example',
  exportedBy: 'Ada',
  exportedAt: '2026-11-03T10:00:00Z',
  items: [
    {
      kind: 'skill',
      id: 'redaction.write',
      title: 'Write',
      version: '2.0',
      state: 'update',
    },
  ],
};

function mountModal({ locale = 'fr', post } = {}) {
  const $post =
    post ||
    jest.fn((url) =>
      Promise.resolve(
        url.endsWith('/preview')
          ? PREVIEW
          : { created: [], updated: [], skipped: [], failed: [] }
      )
    );
  const vm = mountSfc(FILE, {
    mocks: { $axios: { $post }, $i18n: { locale } },
    imports: {
      'lucide-vue': {},
      '~/components/modal-confirm.vue': componentOf(
        'packages/ui/components/modal-confirm.vue'
      ),
      '~/components/ai-skill/bs-ai-skills-import-report.vue': componentOf(
        'packages/ui/components/ai-skill/bs-ai-skills-import-report.vue',
        {
          'lucide-vue': {},
          '~/helpers/skills-import.js': skillsImport,
        }
      ),
      '~/helpers/ai-skill-routes.js': routes,
      '~/helpers/ai-skill-errors.js': errors,
      '~/helpers/skills-import.js': skillsImport,
    },
  });
  return { vm, $post };
}

// The file as the browser gives it.
const fileOf = (json) => ({
  size: 100,
  text: () => Promise.resolve(JSON.stringify(json)),
});

async function previewed(options) {
  const mounted = mountModal(options);
  mounted.vm.open();
  mounted.vm.file = fileOf({ format: 1 });
  await mounted.vm.readFile();
  await settle(mounted.vm);
  return mounted;
}

const buttonSaying = (vm, key) =>
  [...vm.$el.querySelectorAll('v-btn')].find((el) =>
    el.textContent.includes(key)
  );
const cancelButton = (vm) =>
  vm.$el.querySelector('v-card-actions v-btn:not([color="error"])');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the preview of an import', () => {
  it.each([
    ['fr', '03/11/2026'],
    ['en', '11/3/2026'],
  ])('dates the file in the application language, %s', async (locale, date) => {
    const { vm } = await previewed({ locale });

    expect(
      vm.$el.querySelector('.bs-ai-skills-import__from').textContent
    ).toContain(`"date":"${date}"`);
  });

  it('is announced as it comes', async () => {
    const { vm } = await previewed();

    expect(
      vm.$el
        .querySelector('.bs-ai-skills-import__preview')
        .getAttribute('aria-live')
    ).toBe('polite');
  });

  it('lets no other file be chosen while the import runs', async () => {
    let answer;
    const post = jest.fn((url) =>
      url.endsWith('/preview')
        ? Promise.resolve(PREVIEW)
        : new Promise((resolve) => {
            answer = resolve;
          })
    );
    const { vm } = await previewed({ post });
    const otherFile = () => buttonSaying(vm, 'skillsImport.otherFile');
    expect(otherFile().hasAttribute('disabled')).toBe(false);

    buttonSaying(vm, 'skillsImport.run').dispatchEvent(new Event('click'));
    await settle(vm);
    expect(otherFile().hasAttribute('disabled')).toBe(true);

    answer({
      created: [],
      updated: [{ kind: 'skill', id: 'redaction.write', version: '2.0' }],
      skipped: [],
      failed: [],
    });
    await settle(vm);
    expect(vm.$el.querySelector('.bs-ai-skills-import-report')).not.toBeNull();
  });

  it('says a refused import as an alert, in words when the server gives a code', async () => {
    const refused = Object.assign(new Error('Request failed'), {
      response: { data: { message: 'SKILL_ID_TAKEN' } },
    });
    const post = jest.fn((url) =>
      url.endsWith('/preview')
        ? Promise.resolve(PREVIEW)
        : Promise.reject(refused)
    );
    const { vm } = await previewed({ post });

    buttonSaying(vm, 'skillsImport.run').dispatchEvent(new Event('click'));
    await settle(vm);

    const error = vm.$el.querySelector('[role="alert"]');
    expect(error.textContent).toContain(
      'skillsImport.importFailed {"message":"Identifier taken"}'
    );
  });
});

describe('the footer of the modal', () => {
  it('offers to cancel until the import is done, then to close', async () => {
    const { vm } = await previewed();
    expect(cancelButton(vm).textContent.trim()).toBe('global.cancel');

    buttonSaying(vm, 'skillsImport.run').dispatchEvent(new Event('click'));
    await settle(vm);

    expect(cancelButton(vm).textContent.trim()).toBe('global.close');
  });
});
