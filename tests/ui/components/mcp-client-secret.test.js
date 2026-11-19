/**
 * @jest-environment jsdom
 */
'use strict';

// The secret of an MCP client registered by hand (ADR 0012), shown once in a
// dialog that only its button closes. Mounted with the copy simulated: the
// copy goes through the helper that falls back on a browser without the
// clipboard API, and a browser that cannot copy at all leaves the admin a
// box to tick once the secret is saved, never a dialog they cannot leave.

const Vue = require('vue');
const vuex = require('vuex');
const { mountSfc, componentOf, settle } = require('../../helpers/mount-sfc.js');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

const DIALOG = 'packages/ui/components/mcp-clients/modal-mcp-client-secret.vue';
const SETTINGS = 'packages/ui/components/mcp-clients/mcp-client-settings.vue';
const SECRET_ONCE = 'packages/ui/components/modal/bs-secret-once-dialog.vue';

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

let commit;
beforeEach(() => {
  commit = jest.fn();
  // The settings rendered inside the dialog read them from their prototype.
  Vue.prototype.$t = (key) => key;
  Vue.prototype.$store = {
    commit,
    _modulesNamespaceMap: { 'page/': { context: { commit } } },
  };
});

const client = {
  name: 'Copilot Studio',
  clientId: 'lepatron-abc',
  clientSecret: 'the-secret',
};

function mountDialog(copied) {
  const copy = jest.fn().mockResolvedValue(copied);
  const settings = componentOf(SETTINGS, {
    vuex,
    'lucide-vue': {},
    '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
    '~/helpers/copy-to-clipboard.js': { __esModule: true, default: copy },
  });
  const vm = mountSfc(DIALOG, {
    props: { client },
    imports: {
      'lucide-vue': {},
      '~/components/mcp-clients/mcp-client-settings.vue': settings,
      '~/components/modal/bs-secret-once-dialog.vue': componentOf(SECRET_ONCE, {
        'lucide-vue': {},
      }),
    },
  });
  return { vm, copy };
}

const doneButton = (vm) =>
  [...vm.$el.querySelectorAll('v-btn')].find((el) =>
    el.textContent.includes('mcpClients.secretDone')
  );
const copyButtonOf = (vm, key) =>
  vm.$el.querySelector(`.bs-mcp-client-settings__row${key} v-btn`);

describe('the dialog of a new MCP client secret', () => {
  it('closes once the secret is copied, through the helper with a fallback', async () => {
    const { vm, copy } = mountDialog(true);
    const close = jest.fn();
    vm.$on('close', close);
    await settle(vm);

    expect(doneButton(vm).hasAttribute('disabled')).toBe(true);
    copyButtonOf(vm, '--secret').dispatchEvent(new Event('click'));
    await settle(vm);

    expect(copy).toHaveBeenCalledWith('the-secret');
    expect(doneButton(vm).hasAttribute('disabled')).toBe(false);
    doneButton(vm).dispatchEvent(new Event('click'));
    expect(close).toHaveBeenCalled();
  });

  it('says the copy failed, and closes once the admin ticks that the secret is saved', async () => {
    const { vm } = mountDialog(false);
    const close = jest.fn();
    vm.$on('close', close);
    await settle(vm);

    copyButtonOf(vm, '--secret').dispatchEvent(new Event('click'));
    await settle(vm);

    expect(commit).toHaveBeenCalledWith('SHOW_SNACKBAR', {
      text: 'mcpClients.copyFailed',
      color: 'error',
    });
    expect(doneButton(vm).hasAttribute('disabled')).toBe(true);
    doneButton(vm).dispatchEvent(new Event('click'));
    expect(close).not.toHaveBeenCalled();

    vm.$el.querySelector('.v-checkbox-stub').click();
    await settle(vm);

    expect(doneButton(vm).hasAttribute('disabled')).toBe(false);
    doneButton(vm).dispatchEvent(new Event('click'));
    expect(close).toHaveBeenCalled();
  });

  it('starts over, box unticked, for the next client', async () => {
    const { vm } = mountDialog(false);
    await settle(vm);
    vm.$el.querySelector('.v-checkbox-stub').click();
    await settle(vm);

    vm.$props.client = null;
    await settle(vm);
    vm.$props.client = { ...client, clientId: 'lepatron-def' };
    await settle(vm);

    expect(doneButton(vm).hasAttribute('disabled')).toBe(true);
  });

  it.each([
    ['fr', fr, /enregistré ce secret/, /copie a échoué/],
    ['en', en, /saved this secret/, /copy failed/],
  ])('says it in %s', (_lang, messages, saved, failed) => {
    expect(messages.mcpClients.secretSavedConfirm).toMatch(saved);
    expect(messages.mcpClients.copyFailed).toMatch(failed);
    expect(messages.mcpClients.secretDone).toBeTruthy();
  });
});
