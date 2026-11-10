/**
 * @jest-environment jsdom
 */
'use strict';

// An MCP client registered by hand (ADR 0012) redirects over HTTPS, or over
// HTTP to the user's own machine: any other address blocks the creation, and
// the form names the one it refuses.

const vuelidate = require('vuelidate');
const validators = require('vuelidate/lib/validators');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;

function mountModal() {
  const vm = mountSfc(
    'packages/ui/components/mcp-clients/modal-create-mcp-client.vue',
    {
      mocks: {
        $t: (key, params) => (params ? `${key} ${params.uri}` : key),
      },
      imports: {
        vuelidate,
        'vuelidate/lib/validators': validators,
        'lucide-vue': {},
        '~/components/modal/bs-modal-form.vue': {},
        '~/components/form/bs-text-field': {},
        '~/components/form/bs-textarea': {},
        '~/components/form/bs-select': {},
        // The rule the server applies, which the form imports.
        '../../../shared/mcp/redirect-uris.js': require('../../../packages/shared/mcp/redirect-uris.js'),
      },
    }
  );
  return vm;
}

async function errorsFor(vm, text) {
  vm.client.redirectUris = text;
  vm.$v.client.redirectUris.$touch();
  await settle(vm);
  return vm.redirectUrisErrors;
}

describe('the redirect URLs of an MCP client registered by hand', () => {
  it.each([
    ['https://copilot.example.com/callback'],
    ['http://localhost:33418/callback'],
    ['http://127.0.0.1/callback'],
    ['http://[::1]:8080/callback'],
  ])('accepts %s', async (uri) => {
    const vm = mountModal();
    expect(await errorsFor(vm, uri)).toEqual([]);
  });

  it.each([
    ['cursor://anysphere.cursor-retrieval/oauth/callback'],
    ['com.example.app:/callback'],
    ['http://copilot.example.com/callback'],
    ['https://copilot.example.com/callback#fragment'],
    ['http://localhost\\@evil.example/cb'],
    ['http:\\\\localhost/cb'],
    ['https:evil.example'],
    ['HTTP://LOCALHOST/'],
    ['https://user:secret@copilot.example.com/cb'],
  ])('refuses %s, and names it', async (uri) => {
    const vm = mountModal();
    const text = `https://copilot.example.com/callback\n${uri}`;

    expect(await errorsFor(vm, text)).toEqual([
      `mcpClients.errors.redirectUriRefused ${uri}`,
    ]);
  });

  it("names an HTTPS address to the user's own machine beside an HTTP one, as the server does", async () => {
    const vm = mountModal();

    expect(
      await errorsFor(vm, 'https://localhost/cb\nhttp://localhost:8400/cb')
    ).toEqual(['mcpClients.errors.redirectUriRefused https://localhost/cb']);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])('names the address in %s', (_lang, messages) => {
    expect(messages.mcpClients.errors.redirectUriRefused).toContain('{uri}');
  });
});
