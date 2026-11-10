/**
 * @jest-environment jsdom
 */
'use strict';

// The AI features page of a company: a change of its MCP access goes to the
// user store, whose action knows which company the sidebar reads
// (tests/ui/store/user-group-changed.test.js).

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { CAPABILITIES } = require('../../../packages/shared/access/roles.js');

// Stands in for the MCP section: rendered, so the page's listener is bound.
const McpAccessOption = {
  name: 'BsGroupMcpAccessOption',
  props: { group: { type: Object, default: () => ({}) } },
  render(h) {
    return h('div', { class: 'mcp-access-option' });
  },
};

function mountPage(group) {
  const dispatch = jest.fn();
  const vm = mountSfc(
    'packages/ui/routes/groups/_groupId/settings/ai-features.vue',
    {
      mocks: { $t: (key) => key, $store: { dispatch } },
      imports: {
        vuex: { mapGetters: () => ({ can: () => () => false }) },
        '~/helpers/pages-acls.js': { ACL_GROUP_MANAGE_TECH: 'tech' },
        '~/helpers/safe-fetch-group': { safeFetchGroup: () => ({}) },
        '~/helpers/mixins/mixin-settings-title.js': {},
        '~/components/layout/bs-page-header.vue': {},
        '~/components/group/ai-features-tab.vue': {},
        '~/components/group/mcp-access-option.vue': McpAccessOption,
        '~/store/user': {
          CAN: 'CAN',
          GROUP_CHANGED: 'GROUP_CHANGED',
          USER: 'user',
        },
        '../../../../../shared/access/roles.js': { CAPABILITIES },
      },
    }
  );
  vm.group = group;
  return { vm, dispatch };
}

describe('the AI features page', () => {
  it('hands a saved MCP access to the user store', async () => {
    const { vm, dispatch } = mountPage({ id: 'g1', enableMcp: false });
    await settle(vm);

    const section = vm.$children.find(
      (child) => child.$options.name === 'BsGroupMcpAccessOption'
    );
    section.$emit('update', { enableMcp: true, allowRetex: true });

    expect(vm.group).toMatchObject({ enableMcp: true, allowRetex: true });
    expect(dispatch).toHaveBeenCalledWith('user/GROUP_CHANGED', {
      group: vm.group,
      changes: { enableMcp: true },
    });
  });
});
