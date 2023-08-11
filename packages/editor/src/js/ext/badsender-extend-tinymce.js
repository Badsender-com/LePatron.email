const {
  addLetterSpacing,
  fontsizedialog,
  specialcharacters,
  personalizedVariables,
} = require('./tinymce/tinymce-extend-functions');

require('./link-with-color');

function extendTinyMce(opts, viewModel) {
  //////
  // DEFINE TINYMCE CUSTOM PLUGINS
  //////

  //----- LETTER SPACING

  tinymce.PluginManager.add('spacing', addLetterSpacing);

  //----- FREE FONT SIZE

  // inspired by tinymce.js#44265
  tinymce.PluginManager.add('fontsizedialog', fontsizedialog);

  tinymce.PluginManager.add('specialcharacters', specialcharacters);
  tinymce.PluginManager.add('variables', function (editor) {
    personalizedVariables(editor, viewModel);
  });
}

module.exports = extendTinyMce;
