var ko = require('knockout');
const tinymceConfigFull = require('./utils/tinymce-config');
const materialColorScheme = require('./utils/material-color-schema');

/**
 * Setup color picker in order to use it with tinyMce
 * text-color and colorpicker plugins
 */

module.exports = (opts) => {
  function init(viewModel) {
    const tinyMceTextColorConfig = {
      textcolor_cols: '7',
      textcolor_rows: '3',
      textcolor_map: materialColorScheme.reduce(
        (acc, color) => [...acc, color, `#${color}`],
        []
      ),
    };

    const tinyMceColorPickerConfig = {
      color_picker_callback: function (callback, currentColor) {
        if (viewModel.colorpicker) {
          console.log({ colorpicker: viewModel.colorpicker });
          viewModel.colorpicker.show(
            {
              top: mousePosition.y,
              left: mousePosition.x,
              hideDelay: 2000, // default value is 2000. color picker don't hide automatically when hideDelay is zero
            },
            currentColor,
            function (newColor) {
              callback(newColor);
            }
          );
        }
      },
    };

    if (opts.lang === 'fr') {
      tinymceConfigFull.language_url = '/tinymce-langs/fr_FR.js';
      tinymceConfigFull.language = 'fr_FR';
    }
    //- https://www.tinymce.com/docs/configure/url-handling/#convert_urls
    const textEditorFullOptions = $.extend(
      { convert_urls: false },
      {
        ...tinymceConfigFull,
        ...tinyMceTextColorConfig,
        ...tinyMceColorPickerConfig,
      },
      opts.tinymce
    );
    ko.bindingHandlers.wysiwyg.fullOptions = textEditorFullOptions;

    // mirror options to the small version of tinymce
    ko.bindingHandlers.wysiwyg.standardOptions = $.extend(
      true,
      {},
      textEditorFullOptions
    );
  }

  function viewModel(viewModel) {
    viewModel.tinyMceConfiguration = ko.observable(null);
  }

  return {
    init,
    viewModel,
  };
};
