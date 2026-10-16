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
  ROLES,
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');

const GROUP_ID = 'g1';

function load(response, metadata = {}) {
  const vm = { showComments: jest.fn(), save: { execute: jest.fn() } };
  let settle;
  axios.get.mockReturnValue(
    new Promise((resolve, reject) => {
      settle = () =>
        response
          ? resolve({ data: response })
          : reject(new Error('Network Error'));
    })
  );
  currentUserPlugin({ metadata: { groupId: GROUP_ID, ...metadata } }).viewModel(
    vm
  );
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

// The save on opening an email without preview waits for the rights: an
// author's runs once they are known, a reviewer's never does.
describe('whenCurrentUser', () => {
  it('waits for the user, then runs once', async () => {
    const { vm, arrive } = load(userOf('reviewer'));
    const callback = jest.fn();
    vm.whenCurrentUser(callback);

    expect(callback).not.toHaveBeenCalled();
    await arrive();
    vm.currentUser({ ...vm.currentUser() });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('runs at once when the user is already known', async () => {
    const { vm, arrive } = load(userOf('regular_user'));
    await arrive();
    const callback = jest.fn();
    vm.whenCurrentUser(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('never runs when the user could not be loaded', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const { vm, arrive } = load(null);
    const callback = jest.fn();
    vm.whenCurrentUser(callback);
    await arrive();

    expect(callback).not.toHaveBeenCalled();
  });
});

// A member who may read the workspace but not write in it: the server says so
// in the email's metadata, and the editor offers no save it would refuse.
describe('an email the user may not write where it lives', () => {
  it('locks every edit, not the comments', async () => {
    const { vm, arrive } = load(userOf('regular_user'), { canWrite: false });
    await arrive();

    expect(vm.userCan('mailing.edit-content')).toBe(false);
    expect(vm.userCan('mailing.edit-structure')).toBe(false);
    expect(vm.userCan('mailing.organize')).toBe(false);
    expect(vm.userCan('mailing.comment')).toBe(true);
    expect(vm.canSave()).toBe(false);
    expect(vm.isReadOnly()).toBe(true);
  });
});

// An email without a preview is saved on its first opening, by whoever may
// save it, once their rights are known.
describe('saveOnOpen', () => {
  const SAVES = {
    super_admin: true,
    company_admin_tech: true,
    company_admin: true,
    regular_user: true,
    writer: true,
    reviewer: false,
  };

  it('covers every role of the product', () => {
    expect(Object.keys(SAVES).sort()).toEqual(
      Object.values(ROLES).slice().sort()
    );
  });

  it.each(Object.entries(SAVES))('for a %s, saves: %s', async (role, saves) => {
    const { vm, arrive } = load(userOf(role));
    vm.saveOnOpen({ hasHtmlPreview: false });

    expect(vm.save.execute).not.toHaveBeenCalled();
    await arrive();

    expect(vm.save.execute).toHaveBeenCalledTimes(saves ? 1 : 0);
  });

  it('does not save an email that has a preview', async () => {
    const { vm, arrive } = load(userOf('regular_user'));
    vm.saveOnOpen({ hasHtmlPreview: true });
    await arrive();

    expect(vm.save.execute).not.toHaveBeenCalled();
  });

  it('does not save where the user may not write', async () => {
    const { vm, arrive } = load(userOf('regular_user'), { canWrite: false });
    vm.saveOnOpen({ hasHtmlPreview: false });
    await arrive();

    expect(vm.save.execute).not.toHaveBeenCalled();
  });
});
