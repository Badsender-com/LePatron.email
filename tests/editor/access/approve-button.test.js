/**
 * @jest-environment jsdom
 */

'use strict';

// "Approuver" shows from the capability the server sends with the current
// user, mailing.approve (ADR 0020): the reviewer and the admins, never from
// the role, and not from mailing.comment, which every role holds.

const $ = require('jquery');
const ko = require('knockout');
const commentsLoader = require('../../../packages/editor/src/js/ext/badsender-comments.js');
const {
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');
const { fakeViewModel } = require('../quality/fake-view-model');

function editorFor(role) {
  jest.useFakeTimers();
  jest.spyOn($, 'ajax').mockImplementation(() => $.Deferred().promise());
  const vm = fakeViewModel({ blocks: [] });
  vm.selectedBlock = ko.observable(null);
  vm.currentUser = ko.observable(
    role ? { capabilities: capabilitiesOfRole(role) } : null
  );
  commentsLoader({ metadata: { id: 'm1', groupId: 'g1' } })(vm);
  return vm;
}

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the "Approuver" button', () => {
  it.each(['reviewer', 'company_admin', 'company_admin_tech', 'super_admin'])(
    'shows for a %s',
    (role) => {
      expect(editorFor(role).canPostDecision()).toBe(true);
    }
  );

  it.each(['writer', 'regular_user'])('stays hidden for a %s', (role) => {
    expect(editorFor(role).canPostDecision()).toBe(false);
  });

  it('stays hidden until the user is known', () => {
    expect(editorFor(null).canPostDecision()).toBe(false);
  });
});

describe('the unresolved counter of the editor', () => {
  it('counts neither the replies nor the approvals, as the server does', () => {
    const vm = editorFor('reviewer');
    vm.commentsStatus(true);
    vm.comments([
      { _id: 'c1', resolved: false, _parentComment: null, decision: null },
      { _id: 'c2', resolved: true, _parentComment: null, decision: null },
      { _id: 'r1', resolved: false, _parentComment: 'c1', decision: null },
      {
        _id: 'a1',
        resolved: false,
        _parentComment: null,
        decision: 'approved',
      },
    ]);
    expect(vm.unresolvedCommentCount()).toBe(1);
  });
});

describe('approving over an open blocking comment', () => {
  const blocking = (fields = {}) => ({
    _id: 'b1',
    resolved: false,
    _parentComment: null,
    severity: 'blocking',
    decision: null,
    ...fields,
  });

  it('is disabled while a root blocking comment is open', () => {
    const vm = editorFor('reviewer');
    vm.comments([blocking()]);
    expect(vm.hasOpenBlocking()).toBe(true);
  });

  it.each([
    ['resolved', { resolved: true }],
    ['a reply', { _parentComment: 'c0' }],
    ['an approval stored as blocking', { decision: 'approved' }],
  ])('is not held back by a blocking comment %s', (_label, fields) => {
    const vm = editorFor('reviewer');
    vm.comments([blocking(fields)]);
    expect(vm.hasOpenBlocking()).toBe(false);
  });

  it.each([
    ['COMMENT_APPROVAL_BLOCKED', 'comments-approve-blocked'],
    ['COMMENT_APPROVAL_FORBIDDEN', 'comments-approve-forbidden'],
    ['SOMETHING_ELSE', 'comments-create-error'],
  ])('says why the server refused it: %s', (code, key) => {
    const vm = editorFor('reviewer');
    vm.t = (k) => k;
    vm.notifier = { error: jest.fn(), success: jest.fn() };
    $.ajax.mockImplementation((options) => {
      if (options.method === 'POST') {
        options.error({ responseJSON: { message: code } });
      }
      return $.Deferred().promise();
    });
    vm.createComment('approved');
    expect(vm.notifier.error).toHaveBeenCalledWith(key);
  });
});
