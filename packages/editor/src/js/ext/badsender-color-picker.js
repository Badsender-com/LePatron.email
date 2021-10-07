const axios = require('axios');
const { getColorsSet } = require('./utils/helper-functions');

const ColorPicker = require('@easylogic/colorpicker').ColorPicker;

module.exports = (opts) => {
  console.log({ optsInsideColorPickerExtension: opts });
  var groupId = opts.metadata.groupId;
  function init(viewModel) {}

  function viewModel(viewModel) {
    // TODO: find a better way to load colorScheme

    viewModel.colorPicker = ko.observable(null);
    viewModel.colors = ko.observableArray([]);

    axios
      .get(`/api/groups/${groupId}/color-scheme`)
      .then((response) => {
        const colors = response.data?.items;
        viewModel.colors = colors;
        const colorpicker = new ColorPicker({
          outputFormat: 'hex',
          type: 'sketch',
          colorSets: getColorsSet(colors),
        });

        viewModel.colorPicker = colorpicker;
      })
      .catch((error) => {
        // handle error
        console.log(error);
      });
  }

  return {
    init,
    viewModel,
  };
};
