const ko = require('knockout');
const tinymceConfigFull = require('./utils/tinymce-config');


/**
 * Setup color picker in order to use it with tinyMce
 * text-color and colorpicker plugins
 */

// The AI button, first: the toolbar is wider than a narrow canvas, its end
// hidden.
function withAiActions(options) {
  const plugins = Array.isArray(options.plugins)
    ? options.plugins.join(' ')
    : options.plugins || '';
  return {
    ...options,
    plugins: [`${plugins} aiactions`.trim()],
    toolbar1: options.toolbar1
      ? `aiactions | ${options.toolbar1}`
      : 'aiactions',
  };
}

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
      textcolor_rows: '3' };

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
    const merged = $.extend(
      { convert_urls: false },
      textEditorOptions,
      opts.tinymce
    );
    // The AI button opens the field's actions; only a group with text
    // generation has any (#1257). Added to the toolbar the editor ends up
    // with, a template's own included.
    const textEditorFullOptions =
      viewModel.metadata && viewModel.metadata.hasTextGenerationFeature
        ? withAiActions(merged)
        : merged;

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
