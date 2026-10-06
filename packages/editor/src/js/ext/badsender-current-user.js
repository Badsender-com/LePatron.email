const axios = require('axios');
const { userCan } = require('./user-can.js');

const REVIEWER = 'reviewer';
const WRITER = 'writer';

module.exports = (opts) => {
  // Retrieve the current group ID from the metadata
  const currentGroupId = opts.metadata.groupId;

  function viewModel(viewModel) {
    // Initialize observable for the current user
    viewModel.currentUser = ko.observable(null);
    viewModel.canSave = function () {
      return userCan(viewModel, 'canSave');
    };

    // API call to get the current user
    axios
      .get('/api/users/current-user')
      .then((response) => {
        const { isGroupAdmin, group, role, ...restOfCurrentUser } =
          response.data;

        // Determine if the current user is an admin of the current group
        const isAdminOfCurrentGroup =
          isGroupAdmin && group.id === currentGroupId;

        // reviewer: fully read-only on structure/content/style.
        // writer: content only. Every other role (regular_user,
        // company_admin_tech, company_admin, super_admin) is unrestricted.
        // Consumed only as additive read-only overlays (toolbox.tmpl.html,
        // block-wysiwyg.tmpl.html) — never to hide/remove existing elements,
        // which broke the vendored tab-switching mechanism, see git history.
        const canEditStructure = role !== REVIEWER && role !== WRITER;
        const canEditContent = role !== REVIEWER;
        const canEditStyle = role !== REVIEWER && role !== WRITER;
        // Renaming the mailing is an organisation action, like the listing's
        // rename (hidden for reviewer in mailings-table.vue).
        const canRename = role !== REVIEWER;
        // A reviewer changes nothing, so the toolbar's Save has nothing to write.
        // The save run once on opening a mailing without a preview is not this
        // button, and stays for every role (template-loader.js).
        const canSave = role !== REVIEWER;
        // Nothing to edit anywhere: the toolbox drops its tabs and shows a
        // single message instead of one per panel.
        const isReadOnly = !canEditStructure && !canEditContent && !canEditStyle;

        // Update the observable with the current user along with the new attribute
        viewModel.currentUser({
          ...restOfCurrentUser,
          role,
          isAdminOfCurrentGroup,
          isGroupAdmin,
          group,
          canEditStructure,
          canEditContent,
          canEditStyle,
          canRename,
          canSave,
          isReadOnly,
        });

        // A reviewer can edit nothing: the comments panel is what they came for,
        // and open on arrival it shows what they can actually do. Only them —
        // the other roles open it themselves.
        if (
          role === REVIEWER &&
          typeof viewModel.showComments === 'function'
        ) {
          viewModel.showComments(true);
        }
      })
      .catch((error) => {
        // Handle error
        console.log(error);
      });
  }

  return {
    viewModel,
  };
};
