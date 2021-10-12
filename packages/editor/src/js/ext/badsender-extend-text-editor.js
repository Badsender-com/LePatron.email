const ko = require('knockout');
const tinymceConfigFull = require('./utils/tinymce-config');
const { formattedColorSchema } = require('./utils/helper-functions');
const materialColorScheme = require('./utils/material-color-schema');

/**
 * Setup color picker in order to use it with tinyMce
 * text-color and colorpicker plugins
 */

module.exports = (opts) => {
  function viewModel(viewModel) {
    viewModel.tinyMceConfiguration = ko.observable(null);

    const mousePosition = {
      x: 0,
      y: 0,
    };

    const updateMousePosition = (event) => {
      mousePosition.x = event.clientX;
      mousePosition.y = event.clientY;
    };

    document.addEventListener('mousemove', updateMousePosition);

    const tinyMceTextColorConfig = {
      textcolor_cols: '7',
      textcolor_rows: '3',
      textcolor_map: formattedColorSchema(materialColorScheme),
    };

    const tinyMceColorPickerConfig = {
      color_picker_callback: function (callback, currentColor) {
        if (viewModel.colorPicker) {
          viewModel.colorPicker.show(
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

    const textEditorOptions = {
      ...tinymceConfigFull,
      ...tinyMceTextColorConfig,
      ...tinyMceColorPickerConfig,
    };

    //- https://www.tinymce.com/docs/configure/url-handling/#convert_urls
    const textEditorFullOptions = $.extend(
      { convert_urls: false },
      textEditorOptions,
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

  return {
    viewModel,
  };
};
