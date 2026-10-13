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

  //----- AI ACTIONS (ADR 0004): the field being edited, in the AI panel

  tinymce.PluginManager.add('aiactions', function (editor) {
    editor.addButton('aiactions', {
      tooltip: viewModel.t('ai-field-correct-label'),
      icon: 'ai-bot',
      onclick() {
        if (viewModel.openAiOnElement) viewModel.openAiOnElement(editor.getElement());
      },
    });
  });
}

module.exports = extendTinyMce;
