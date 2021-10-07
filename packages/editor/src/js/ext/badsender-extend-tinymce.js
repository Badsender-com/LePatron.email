const {
  addLetterSpacing,
  fontsizedialog,
  specialcharacters,
} = require('./tinymce/tinymce-extend-functions');

require('./link-with-color');

function extendTinyMce() {
  //////
  // DEFINE TINYMCE CUSTOM PLUGINS
  //////

  //----- LETTER SPACING

  tinymce.PluginManager.add('spacing', addLetterSpacing);

  //----- FREE FONT SIZE

  // inspired by tinymce.js#44265
  tinymce.PluginManager.add('fontsizedialog', fontsizedialog);

  tinymce.PluginManager.add('specialcharacters', specialcharacters);
}

module.exports = extendTinyMce;
