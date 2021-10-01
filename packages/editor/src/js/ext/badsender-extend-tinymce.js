const {
  addLetterSpacing,
  fontsizedialog,
  specialcharacters,
} = require('./tinymce/tinymce-extend-functions');

function extendTinyMce() {
  console.log('calling extendTinyMce');
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
