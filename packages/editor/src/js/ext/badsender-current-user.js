const axios = require('axios');
const { userCan } = require('./user-can.js');
const { CAPABILITIES } = require('../../../../shared/access/roles.js');

module.exports = (opts) => {
  // Retrieve the current group ID from the metadata
  const currentGroupId = opts.metadata.groupId;

  function viewModel(viewModel) {
    // Initialize observable for the current user
    viewModel.currentUser = ko.observable(null);
    // Without the current user, the editor knows none of its rights and
    // locks everything: it says so instead of claiming a refusal.
    viewModel.currentUserFailed = ko.observable(false);

    // What the user may do, as the server sent it with the current user.
    viewModel.userCan = function (capability) {
      return userCan(viewModel, capability);
    };
    // A reviewer changes nothing, so the toolbar's Save has nothing to write.
    viewModel.canSave = function () {
      return userCan(viewModel, CAPABILITIES.MAILING_EDIT_CONTENT);
    };
    // Nothing to edit anywhere: the toolbox drops its tabs and shows a single
    // message instead of one per panel. Only once the user is known, so the
    // tabs do not flicker away while it loads.
    viewModel.isReadOnly = ko.pureComputed(function () {
      return (
        !!viewModel.currentUser() &&
        !userCan(viewModel, CAPABILITIES.MAILING_EDIT_STRUCTURE) &&
        !userCan(viewModel, CAPABILITIES.MAILING_EDIT_CONTENT) &&
        !userCan(viewModel, CAPABILITIES.MAILING_EDIT_STYLE)
      );
    });
    // The message of a locked toolbox panel: still loading, unknown rights, or
    // the right the role lacks. `area` is structure, content or style.
    viewModel.lockMessageKey = function (area) {
      if (viewModel.currentUserFailed()) return 'toolbox-rights-unavailable';
      if (!viewModel.currentUser()) return 'toolbox-rights-loading';
      if (viewModel.isReadOnly()) return 'toolbox-readonly-all';
      return 'toolbox-readonly-' + area;
    };

    // Runs `callback` once the current user is known, at once if it already
    // is; never when it could not be loaded, since nothing is allowed then.
    viewModel.whenCurrentUser = function (callback) {
      if (viewModel.currentUser()) return callback();
      const subscription = viewModel.currentUser.subscribe(function (user) {
        if (!user) return;
        subscription.dispose();
        callback();
      });
    };

    // API call to get the current user
    axios
      .get('/api/users/current-user')
      .then((response) => {
        const { isGroupAdmin, group, ...restOfCurrentUser } = response.data;

        // Whoever manages the mailing's group: its company admin, or a super
        // admin, who has every right in every group (ADR 0002, amended).
        const isAdminOfCurrentGroup =
          restOfCurrentUser.isAdmin === true ||
          (isGroupAdmin && !!group && group.id === currentGroupId);

        // The capabilities are consumed only as additive read-only overlays
        // (toolbox.tmpl.html, block-wysiwyg.tmpl.html) — never to hide/remove
        // existing elements, which broke the vendored tab-switching mechanism,
        // see git history.
        viewModel.currentUser({
          ...restOfCurrentUser,
          isAdminOfCurrentGroup,
          isGroupAdmin,
          group,
        });

        // Someone who can edit nothing came for the comments: open on arrival,
        // the panel shows what they can actually do. The others open it
        // themselves.
        if (
          viewModel.isReadOnly() &&
          typeof viewModel.showComments === 'function'
        ) {
          viewModel.showComments(true);
        }
      })
      .catch((error) => {
        viewModel.currentUserFailed(true);
        console.log(error);
      });
  }

  return {
    viewModel,
  };
};
