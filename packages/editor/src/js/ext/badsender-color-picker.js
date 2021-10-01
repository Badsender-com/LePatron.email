const axios = require('axios');
const materialColorScheme = require('./utils/material-color-schema');

module.exports = (opts) => {
  var groupId = opts.metadata.groupId;
  function init(viewModel) {
    axios
      .get(`/api/groups/${groupId}/color-scheme`)
      .then((response) => {
        console.log({ responseFromColorScheme: response });
      })
      .catch((error) => {
        // handle error
        vm.notifier.error(viewModel.t('error-server'));
      });
    initColorPicker(viewModel);
  }

  function viewModel(viewModel) {
    viewModel.colors = ko.observableArray([]);
    viewModel.colorPicker = ko.observable(null);
  }

  function initColorPicker(viewModel) {
    // Needed to know where to display the colorpicker
    const mousePosition = {
      x: 0,
      y: 0,
    };

    const updateMousePosition = (event) => {
      mousePosition.x = event.clientX;
      mousePosition.y = event.clientY;
    };

    document.addEventListener('mousemove', updateMousePosition);

    window.addEventListener('DOMContentLoaded', () => {
      // TODO: find a better way to load colorScheme
      const colors = ['000', 'fff'];
      console.log('colors', colors);
      colorpicker = new ColorPicker({
        outputFormat: 'hex',
        type: 'palette',
        colorSets: [
          colors?.length
            ? {
                name: 'Group Scheme',
                colors,
              }
            : {
                name: 'Material',
                colors: materialColorScheme.map((color) => `#${color}`),
              },
        ],
      });
      viewModel.colorPicker(colorpicker);
    });
  }

  return {
    init,
    viewModel,
  };
};
