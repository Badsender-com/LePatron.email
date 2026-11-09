/**
 * @jest-environment jsdom
 */
'use strict';

// What the MCP clients page says when the API refuses (ADR 0012): the error
// code the API answers as its message, in French and in English, and the
// redirect URI it refuses, named.

const { mountSfc } = require('../../helpers/mount-sfc.js');
const fr = require('../../../packages/ui/helpers/locales/fr.js').default;
const en = require('../../../packages/ui/helpers/locales/en.js').default;
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const MESSAGES = { fr, en };
const has = (messages, key) =>
  key.split('.').reduce((node, part) => node?.[part], messages) !== undefined;

function mountPage() {
  const showSnackbar = jest.fn();
  const vm = mountSfc(
    'packages/ui/routes/groups/_groupId/settings/mcp-clients.vue',
    {
      mocks: {
        $t: (key, params = {}) => [key, ...Object.values(params)].join(' | '),
        $te: (key) => has(en, key),
        $route: { params: { groupId: 'g1' } },
      },
      imports: {
        vuex: {
          mapGetters: () => ({ can: () => () => false }),
          mapMutations: () => ({ showSnackbar }),
        },
        'lucide-vue': {},
        '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
        '~/helpers/pages-acls.js': {},
        '~/helpers/api-routes.js': {},
        '~/helpers/safe-fetch-group': {},
        '~/helpers/mixins/mixin-settings-title.js': {},
        '~/store/user': { CAN: 'can', USER: 'user' },
        '../../../../../shared/access/roles.js': { CAPABILITIES: {} },
        '~/components/layout/bs-page-header.vue': {},
        '~/components/modal-confirm.vue': {},
        '~/components/mcp-clients/modal-create-mcp-client.vue': {},
        '~/components/mcp-clients/mcp-client-settings.vue': {},
        '~/components/mcp-clients/modal-mcp-client-secret.vue': {},
      },
    }
  );
  return { vm, showSnackbar };
}

// As the API answers it: the error code as the message.
const refusal = (data) =>
  Object.assign(new Error(data.message), { response: { status: 400, data } });

describe('a refusal of the MCP clients API', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ERROR_CODES.MCP_CLIENT_INVALID_NAME,
    ERROR_CODES.MCP_CLIENT_INVALID_REDIRECT_URIS,
    ERROR_CODES.MCP_CLIENT_INVALID_AUTH_METHOD,
    ERROR_CODES.MCP_CLIENT_INVALID_METADATA,
    ERROR_CODES.MCP_CLIENT_NOT_FOUND,
    ERROR_CODES.MCP_FORBIDDEN_COMPANY,
  ])('says what %s means', (code) => {
    const { vm, showSnackbar } = mountPage();

    vm.notifyError(refusal({ message: code }));

    expect(showSnackbar).toHaveBeenCalledWith({
      text: `mcpClients.errors.${code}`,
      color: 'error',
    });
  });

  it('names the redirect URI the API refuses', () => {
    const { vm, showSnackbar } = mountPage();

    vm.notifyError(
      refusal({
        message: ERROR_CODES.MCP_CLIENT_INVALID_REDIRECT_URIS,
        redirectUri: 'http://assistant.example.test/callback',
      })
    );

    expect(showSnackbar).toHaveBeenCalledWith({
      text:
        'mcpClients.errors.redirectUriRefused | http://assistant.example.test/callback',
      color: 'error',
    });
  });

  it('says an error occurred for anything else', () => {
    const { vm, showSnackbar } = mountPage();

    vm.notifyError(new Error('Network Error'));

    expect(showSnackbar).toHaveBeenCalledWith({
      text: 'global.errors.errorOccured',
      color: 'error',
    });
  });
});

describe.each(Object.keys(MESSAGES))('the MCP error messages in %s', (lang) => {
  it.each([
    'MCP_CLIENT_INVALID_NAME',
    'MCP_CLIENT_INVALID_REDIRECT_URIS',
    'MCP_CLIENT_INVALID_AUTH_METHOD',
    'MCP_CLIENT_INVALID_METADATA',
    'MCP_CLIENT_NOT_FOUND',
    'MCP_FORBIDDEN_COMPANY',
  ])('say what the clients API means by %s', (code) => {
    expect(has(MESSAGES[lang], `mcpClients.errors.${ERROR_CODES[code]}`)).toBe(
      true
    );
  });

  it('say what the connections API means by MCP_CONNECTION_NOT_FOUND', () => {
    expect(
      has(
        MESSAGES[lang],
        `connectedApplications.errors.${ERROR_CODES.MCP_CONNECTION_NOT_FOUND}`
      )
    ).toBe(true);
  });

  it('keep no key of the former codes', () => {
    [
      'invalid_name',
      'invalid_redirect_uris',
      'invalid_auth_method',
      'invalid_client_metadata',
      'not_found',
    ].forEach((former) =>
      expect(has(MESSAGES[lang], `mcpClients.errors.${former}`)).toBe(false)
    );
  });
});
