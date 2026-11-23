const {
  addLetterSpacing,
  fontsizedialog,
  specialcharacters,
  personalizedVariables,
} = require('./tinymce/tinymce-extend-functions');

require('./link-with-color');

/**
 * The AI button of the text editor's toolbar (#1257). Configured for every
 * editor of a group with text generation, before the user is known: shown
 * only while the AI panel offers something on the element edited, and named
 * after what it opens (the action, or « Outils IA »). Read when the button is
 * rendered and each time the editor takes the focus.
 */
function aiActions(viewModel) {
  return function (editor) {
    editor.addButton('aiactions', {
      // A tooltip from the start: TinyMCE shows one only if it has one.
      tooltip: viewModel.t('ai-panel-title'),
      icon: 'ai-bot',
      onPostRender() {
        const button = this;
        // Alone in its group, first in the toolbar: the group goes with it.
        const group = button.parent();
        const shown =
          group && group.items && group.items().length === 1 ? group : button;
        const update = () => {
          const label =
            viewModel.aiLabelOnElement &&
            viewModel.aiLabelOnElement(editor.getElement());
          shown.visible(Boolean(label));
          if (!label) return;
          button.settings.tooltip = label;
          button.aria('label', label);
        };
        update();
        editor.on('focus', update);
      },
      onclick() {
        if (viewModel.openAiOnElement) {
          viewModel.openAiOnElement(editor.getElement());
        }
      },
    });
  };
}

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

  //----- AI ACTIONS (ADR 0010): the field being edited, in the AI panel

  tinymce.PluginManager.add('aiactions', aiActions(viewModel));
}

module.exports = extendTinyMce;
module.exports.aiActions = aiActions;
