'use strict';

// The editor knows the rights of its user from the capabilities the server
// sends with the current user. Until they arrive it locks everything and says
// it is loading; if they never arrive it says so, instead of telling an author
// they have no right to edit.

jest.mock('axios', () => ({ get: jest.fn() }));

const ko = require('knockout');
const axios = require('axios');

global.ko = ko;

const currentUserPlugin = require('../../../packages/editor/src/js/ext/badsender-current-user.js');
const {
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');

const GROUP_ID = 'g1';

function load(response) {
  const vm = { showComments: jest.fn() };
  let settle;
  axios.get.mockReturnValue(
    new Promise((resolve, reject) => {
      settle = () =>
        response
          ? resolve({ data: response })
          : reject(new Error('Network Error'));
    })
  );
  currentUserPlugin({ metadata: { groupId: GROUP_ID } }).viewModel(vm);
  return {
    vm,
    arrive: async () => {
      settle();
      await new Promise(setImmediate);
    },
  };
}

const userOf = (role) => ({
  role,
  capabilities: capabilitiesOfRole(role),
  group: { id: GROUP_ID },
});

beforeEach(() => jest.clearAllMocks());

describe('the current user of the editor', () => {
  it('locks everything while it loads, and says so', () => {
    const { vm } = load(userOf('regular_user'));

    expect(vm.userCan('mailing.edit-content')).toBe(false);
    expect(vm.canSave()).toBe(false);
    expect(vm.isReadOnly()).toBe(false);
    expect(vm.lockMessageKey('content')).toBe('toolbox-rights-loading');
  });

  it('says the rights are unknown when they cannot be loaded', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const { vm, arrive } = load(null);
    await arrive();

    expect(vm.userCan('mailing.edit-content')).toBe(false);
    expect(vm.lockMessageKey('structure')).toBe('toolbox-rights-unavailable');
    expect(vm.showComments).not.toHaveBeenCalled();
  });

  it('opens what an author may do', async () => {
    const { vm, arrive } = load(userOf('regular_user'));
    await arrive();

    expect(vm.userCan('mailing.edit-structure')).toBe(true);
    expect(vm.canSave()).toBe(true);
    expect(vm.isReadOnly()).toBe(false);
    expect(vm.showComments).not.toHaveBeenCalled();
  });

  it('locks the structure and the style of a writer, not the content', async () => {
    const { vm, arrive } = load(userOf('writer'));
    await arrive();

    expect(vm.userCan('mailing.edit-content')).toBe(true);
    expect(vm.userCan('mailing.edit-structure')).toBe(false);
    expect(vm.lockMessageKey('style')).toBe('toolbox-readonly-style');
  });

  it('opens the comments of someone who can edit nothing', async () => {
    const { vm, arrive } = load(userOf('reviewer'));
    await arrive();

    expect(vm.canSave()).toBe(false);
    expect(vm.isReadOnly()).toBe(true);
    expect(vm.lockMessageKey('content')).toBe('toolbox-readonly-all');
    expect(vm.showComments).toHaveBeenCalledWith(true);
  });
});
