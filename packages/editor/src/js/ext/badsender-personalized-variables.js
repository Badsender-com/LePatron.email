const axios = require('axios');

module.exports = (opts) => {
  const groupId = opts.metadata.groupId;

  function viewModel(viewModel) {
    // Initialize observables for variables
    viewModel.personalizedVariables = ko.observableArray([]);

    // API call to recover personalized variables
    axios
      .get(`/api/groups/${groupId}/personalized-variables`)
      .then((response) => {
        const variables = response.data.items;
        viewModel.personalizedVariables = variables;  // Update the observable with the data received
      })
      .catch((error) => {
        // handle error
        console.log(error);
      });
  }

  return {
    viewModel,
  };
};
