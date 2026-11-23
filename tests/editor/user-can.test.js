'use strict';

const { userCan } = require('../../packages/editor/src/js/ext/user-can.js');
const { userOfRole } = require('./helpers/current-user.js');

// The editor reads the capabilities the server sends with the current user:
// it knows no role.
describe('userCan', () => {
  it('grants a capability the user holds', () => {
    const vm = { currentUser: userOfRole('writer') };

    expect(userCan(vm, 'mailing.edit-content')).toBe(true);
  });

  it('refuses a capability the user lacks', () => {
    const vm = { currentUser: userOfRole('writer') };

    expect(userCan(vm, 'mailing.edit-structure')).toBe(false);
  });

  it('leaves ignoring a quality finding to the authors, where they may write', () => {
    expect(
      userCan(
        { currentUser: userOfRole('regular_user') },
        'mailing.ignore-quality'
      )
    ).toBe(true);
    expect(
      userCan({ currentUser: userOfRole('writer') }, 'mailing.ignore-quality')
    ).toBe(false);
    expect(
      userCan(
        { currentUser: userOfRole('regular_user'), canWriteMailing: false },
        'mailing.ignore-quality'
      )
    ).toBe(false);
  });

  // currentUser is loaded asynchronously: until then, nothing is allowed.
  it('refuses everything until the user is loaded', () => {
    expect(userCan({ currentUser: () => null }, 'mailing.comment')).toBe(false);
    expect(userCan({}, 'mailing.comment')).toBe(false);
  });

  it('refuses a user sent without capabilities', () => {
    const vm = { currentUser: () => ({ role: 'regular_user' }) };

    expect(userCan(vm, 'mailing.comment')).toBe(false);
  });

  it('throws on a misspelt capability instead of refusing everyone', () => {
    const vm = { currentUser: userOfRole('regular_user') };

    expect(() => userCan(vm, 'mailing.edit-structre')).toThrow();
  });
});
