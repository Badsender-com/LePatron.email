/**
 * @jest-environment jsdom
 */
'use strict';

// The AI features page of a company: a change of its MCP access goes to the
// user store, whose action knows which company the sidebar reads
// (tests/ui/store/user-group-changed.test.js), and the content of its AI
// invocation logs, once saved, stays on the page.

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

// Stands in for the switch of the logs' content.
const LogContentOption = {
  name: 'BsGroupAiLogContentOption',
  props: { group: { type: Object, default: () => ({}) } },
  render(h) {
    return h('div', { class: 'ai-log-content-option' });
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
        '~/components/group/ai-log-content-option.vue': LogContentOption,
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

  it('keeps the content switch as saved', async () => {
    const { vm } = mountPage({ id: 'g1', logSkillInvocationContent: true });
    await settle(vm);

    const section = vm.$children.find(
      (child) => child.$options.name === 'BsGroupAiLogContentOption'
    );
    section.$emit('update', { id: 'g1', logSkillInvocationContent: false });

    expect(vm.group.logSkillInvocationContent).toBe(false);
  });
});
