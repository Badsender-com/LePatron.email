const axios = require('axios');

module.exports = (opts) => {
  // Retrieve the current mailing ID from the metadata
  const currentMailingId = opts.metadata.id;

  function viewModel(viewModel) {
    // Initialize an observable for the current mailing information
    viewModel.currentMailing = ko.observable(null);

    // API call to get detailed information about the current mailing
    axios
      .get(`/api/mailings/${currentMailingId}`)
      .then((response) => {
        const detailedMailInfo = response.data;
        viewModel.currentMailing(detailedMailInfo);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  return {
    viewModel,
  };
};
