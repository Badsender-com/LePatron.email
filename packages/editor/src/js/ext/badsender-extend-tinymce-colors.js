const {
  addTextMapColors
} = require('./tinymce/tinymce-extend-functions');
const { formattedColorSchema, formattedGroupColorSchema } = require('./utils/helper-functions');
const materialColorScheme = require('./utils/material-color-schema');
module.exports = (opts) => {
  function init(viewModel) {
    tinymce.PluginManager.add('extendColors', (editor) => {
      editor.settings.textcolor_map =  viewModel?.colors?.length ? formattedGroupColorSchema(viewModel?.colors) : formattedColorSchema(materialColorScheme);
    });
  }
  return {
    init,
  };
};