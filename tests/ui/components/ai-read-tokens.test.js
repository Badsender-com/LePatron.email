/**
 * @jest-environment jsdom
 */
'use strict';

// Production's read tokens (ADR 0019), mounted with the server simulated: a
// token is shown once, in a dialog that closes once it is copied or once the
// admin ticks that it is saved, never a dialog they cannot leave. A copy is
// no source: it creates no token.

const Vue = require('vue');
const vuex = require('vuex');
const vuelidate = require('vuelidate');
const validators = require('vuelidate/lib/validators');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const routes = require('~/helpers/ai-skill-routes.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const FILE = 'packages/ui/components/ai-skill/bs-ai-read-tokens.vue';

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
Vue.filter('preciseDateTime', (value) => String(value));

// A modal the component opens and closes by its ref.
const modalStub = {
  methods: { open() {}, close() {} },
  render(h) {
    return h('div', this.$slots.default);
  },
};

let commit;
beforeEach(() => {
  commit = jest.fn();
  Vue.prototype.$t = (key) => key;
  Vue.prototype.$store = {
    commit,
    _modulesNamespaceMap: { 'page/': { context: { commit } } },
  };
});
afterEach(() => {
  document.body.innerHTML = '';
});

const TOKEN = {
  id: 't1',
  name: 'Recette',
  createdAt: '2026-11-01T10:00:00Z',
  lastUsedAt: null,
};

function mountTokens({ isCopy = false, items = [], copied = true } = {}) {
  const copy = jest.fn().mockResolvedValue(copied);
  const $axios = {
    $get: jest.fn().mockResolvedValue({ items }),
    $post: jest.fn((_url, { name }) =>
      Promise.resolve({ ...TOKEN, id: name, name, token: 'the-token' })
    ),
    $delete: jest.fn().mockResolvedValue({}),
  };
  const vm = mountSfc(FILE, {
    props: { isCopy },
    mocks: { $axios, $i18n: { locale: 'fr' } },
    imports: {
      vuex,
      vuelidate,
      'vuelidate/lib/validators': validators,
      'lucide-vue': {},
      '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
      '~/helpers/ai-skill-routes.js': routes,
      '~/helpers/copy-to-clipboard.js': { __esModule: true, default: copy },
      '~/components/modal/bs-modal-form.vue': modalStub,
      '~/components/modal-confirm.vue': modalStub,
      '~/components/form/bs-text-field': {},
    },
  });
  return { vm, $axios, copy };
}

const buttonSaying = (vm, key) =>
  [...vm.$el.querySelectorAll('v-btn')].find((el) =>
    el.textContent.includes(key)
  );
const doneButton = (vm) => vm.$el.querySelector('.bs-ai-read-tokens__done');

async function created(options) {
  const mounted = mountTokens(options);
  await settle(mounted.vm);
  mounted.vm.name = 'Recette';
  await mounted.vm.createToken();
  await settle(mounted.vm);
  return mounted;
}

describe('the read tokens of production', () => {
  it('offers to create one on production', async () => {
    const { vm } = mountTokens();
    await settle(vm);

    expect(buttonSaying(vm, 'aiSkills.readTokens.add')).toBeTruthy();
    expect(vm.$el.textContent).toContain('aiSkills.readTokens.emptyHint');
  });

  it('creates none on a copy, and still revokes what it has', async () => {
    const { vm } = mountTokens({ isCopy: true, items: [TOKEN] });
    await settle(vm);

    expect(buttonSaying(vm, 'aiSkills.readTokens.add')).toBeUndefined();
    expect(vm.$el.textContent).toContain(
      'aiSkills.readTokens.descriptionOnCopy'
    );
    expect(
      vm.$el.querySelector('.bs-ai-read-tokens__token').textContent
    ).toContain('Recette');
  });

  it('says a copy is no source when it has none', async () => {
    const { vm } = mountTokens({ isCopy: true });
    await settle(vm);
    expect(vm.$el.textContent).toContain('aiSkills.readTokens.emptyOnCopy');
  });

  it('closes the token dialog once the token is copied', async () => {
    const { vm, copy, $axios } = await created();

    expect($axios.$post).toHaveBeenCalledWith('/ai-skills/read-tokens', {
      name: 'Recette',
    });
    expect(doneButton(vm).hasAttribute('disabled')).toBe(true);
    vm.$el
      .querySelector('.bs-ai-read-tokens__copy')
      .dispatchEvent(new Event('click'));
    await settle(vm);

    expect(copy).toHaveBeenCalledWith('the-token');
    expect(doneButton(vm).hasAttribute('disabled')).toBe(false);
    doneButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);
    expect(vm.$el.textContent).not.toContain('the-token');
  });

  it('says the copy failed, and closes once the admin ticks that the token is saved', async () => {
    const { vm } = await created({ copied: false });

    vm.$el
      .querySelector('.bs-ai-read-tokens__copy')
      .dispatchEvent(new Event('click'));
    await settle(vm);

    expect(commit).toHaveBeenCalledWith('SHOW_SNACKBAR', {
      text: 'aiSkills.readTokens.copyFailed',
      color: 'error',
    });
    doneButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);
    expect(vm.$el.textContent).toContain('the-token');

    vm.$el.querySelector('.v-checkbox-stub').click();
    await settle(vm);
    expect(doneButton(vm).hasAttribute('disabled')).toBe(false);
    doneButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);
    expect(vm.$el.textContent).not.toContain('the-token');
  });

  it('starts over, box unticked, for the next token', async () => {
    const { vm } = await created({ copied: false });
    vm.$el.querySelector('.v-checkbox-stub').click();
    await settle(vm);
    doneButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    vm.name = 'Dev';
    await vm.createToken();
    await settle(vm);

    expect(doneButton(vm).hasAttribute('disabled')).toBe(true);
  });

  it.each([
    ['fr', fr, /enregistré ce jeton/, /copie a échoué/, /production/],
    ['en', en, /saved this token/, /copy failed/, /production/],
  ])('says it in %s', (_lang, messages, saved, failed, onCopy) => {
    const words = messages.aiSkills.readTokens;
    expect(words.savedConfirm).toMatch(saved);
    expect(words.copyFailed).toMatch(failed);
    expect(words.descriptionOnCopy).toMatch(onCopy);
    expect(words.emptyOnCopy).toBeTruthy();
  });
});

describe('the tab of production and its copies', () => {
  const TAB = 'packages/ui/components/ai-skill/bs-ai-sync-tab.vue';
  const tokensStub = {
    props: { isCopy: Boolean },
    render(h) {
      return h('div', {
        class: 'tokens-stub',
        attrs: { 'data-copy': String(this.isCopy) },
      });
    },
  };
  const followStub = {
    render(h) {
      return h('div', { class: 'follow-stub' });
    },
  };

  it('shows the tokens once it knows whether this instance is a copy, and tells them', async () => {
    const vm = mountSfc(TAB, {
      imports: {
        '~/components/ai-skill/bs-ai-follow-production.vue': followStub,
        '~/components/ai-skill/bs-ai-read-tokens.vue': tokensStub,
      },
    });
    expect(vm.$el.querySelector('.tokens-stub')).toBeNull();

    vm.$children[0].$emit('state', { isCopy: true });
    await settle(vm);

    expect(vm.$el.querySelector('.tokens-stub').getAttribute('data-copy')).toBe(
      'true'
    );
  });
});
