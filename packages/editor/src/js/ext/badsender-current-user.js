const axios = require('axios');

const REVIEWER = 'reviewer';
const WRITER = 'writer';

module.exports = (opts) => {
  // Retrieve the current group ID from the metadata
  const currentGroupId = opts.metadata.groupId;

  function viewModel(viewModel) {
    // Initialize observable for the current user
    viewModel.currentUser = ko.observable(null);

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
          isReadOnly,
        });
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
