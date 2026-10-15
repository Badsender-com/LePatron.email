const axios = require('axios');

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
        const { isGroupAdmin, group, ...restOfCurrentUser } = response.data;

        // Whoever manages the mailing's group: its company admin, or a super
        // admin, who has every right in every group (ADR 0002, amended).
        const isAdminOfCurrentGroup =
          restOfCurrentUser.isAdmin === true ||
          (isGroupAdmin && !!group && group.id === currentGroupId);

        // Update the observable with the current user along with the new attribute
        viewModel.currentUser({
          ...restOfCurrentUser,
          isAdminOfCurrentGroup,
          isGroupAdmin,
          group,
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
