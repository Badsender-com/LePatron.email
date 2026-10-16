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

    // Whether the server accepts a save where this email lives (its workspace
    // or folder): writing the email needs it on top of the capability
    // (user-can.js).
    viewModel.canWriteMailing = opts.metadata.canWrite !== false;
    // What the user may do, as the server sent it with the current user.
    viewModel.userCan = function (capability) {
      return userCan(viewModel, capability);
    };
    // A reviewer, or a member who may only read the workspace, changes
    // nothing: the toolbar's Save has nothing to write.
    viewModel.canSave = function () {
      return userCan(viewModel, CAPABILITIES.MAILING_EDIT_CONTENT);
    };
    // Whoever manages the email's group: the platform, which manages every
    // group (ADR 0002, amended), or a manager of its own group when it is the
    // email's. Deletes any comment, edits and deletes the group's saved
    // blocks.
    viewModel.managesCurrentGroup = function () {
      if (userCan(viewModel, CAPABILITIES.PLATFORM_MANAGE)) return true;
      const user = viewModel.currentUser();
      return (
        userCan(viewModel, CAPABILITIES.GROUP_MANAGE) &&
        !!user.group &&
        user.group.id === currentGroupId
      );
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

    // An email without a preview is saved on its first opening, which stores
    // its content and its rendering (the HTML the exports send), by whoever
    // may save it, once their rights are known. Called by template-loader.js
    // when the editor starts with the email's metadata, `save` being
    // Mosaico's command.
    viewModel.saveOnOpen = function (metadata) {
      if (!metadata || metadata.hasHtmlPreview) return;
      viewModel.whenCurrentUser(function () {
        if (viewModel.canSave() && viewModel.save && viewModel.save.execute) {
          viewModel.save.execute();
        }
      });
    };

    // API call to get the current user
    axios
      .get('/api/users/current-user')
      .then((response) => {
        // The toolbox's tabs are locked by overlays (toolbox.tmpl.html), never
        // removed: removing them broke the vendored tab-switching mechanism,
        // see git history. Single buttons may be hidden (`ko if: userCan`).
        viewModel.currentUser({ ...response.data });

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
