'use strict';

const { userCan } = require('../../packages/editor/src/js/ext/user-can.js');

describe('userCan', () => {
  it('grants a capability the user holds', () => {
    expect(userCan({ currentUser: () => ({ canSave: true }) }, 'canSave')).toBe(
      true
    );
  });

  it('refuses a capability the user lacks or that does not exist', () => {
    const vm = { currentUser: () => ({ canSave: false }) };
    expect(userCan(vm, 'canSave')).toBe(false);
    expect(userCan(vm, 'canFly')).toBe(false);
  });

  // currentUser is loaded asynchronously: until then, nothing is allowed.
  it('refuses everything until the user is loaded', () => {
    expect(userCan({ currentUser: () => null }, 'canSave')).toBe(false);
    expect(userCan({}, 'canSave')).toBe(false);
  });
});
