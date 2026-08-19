'use strict';

// Widget for the `code` property type, declared by the injected block
// definitions as `htmlCode { widget: code; }`.
//
// Mosaico passes any unknown declaration straight through to `_widget`
// (converter/stylesheet.js), and plugin widgets are looked up before the native
// ones (converter/editor.js #_propInput), so no converter change is needed.
//
// The editing surface is not in this panel: #main-toolbox is 400px wide, which is
// unusable for HTML. The button opens the CodeMirror modal instead — same shape
// as badsender-widget-bgimage.js, whose button opens the gallery dialog.

// The hidden input keeps the property bound (and focus-tracked) the way native
// widgets do, so selecting the block still highlights it in the canvas.
function html(propAccessor, onfocusbinding, parameters) {
  return `
    <input type="hidden" id="${propAccessor}" data-bind="value: ${propAccessor}, ${onfocusbinding}" />
    <div class="html-code-widget">
      <button class="html-code-widget__button" data-bind="button: { icons: { primary: 'lucide lucide-code-2' } }, text: $root.t('widget-code-edit'), click: function(blockProperties, evt) { $root.openHtmlCodeEditor('${propAccessor}', blockProperties); }">Edit HTML code</button>
    </div>
  `;
}

module.exports = () => {
  function widget() {
    return {
      widget: 'code',
      defaultParameters: Object.freeze({}),
      html,
    };
  }

  function viewModel(vm) {
    // Set by the Vue modal once it is mounted (same handshake as
    // vm.toggleSaveBlockModal in save-modal.js). Guarded so a click before the
    // modal mounts is a no-op rather than a TypeError.
    vm.toggleHtmlCodeModal = null;

    vm.openHtmlCodeEditor = function (propAccessor, blockProperties) {
      if (typeof vm.toggleHtmlCodeModal !== 'function') return;
      if (!blockProperties || !blockProperties[propAccessor]) return;

      // Hand over the accessor rather than the value, so the modal writes back
      // to the very property the user clicked — same approach as
      // badsender-widget-bgimage.js's currentBgimage.
      vm.toggleHtmlCodeModal(true, {
        accessor: blockProperties[propAccessor].bind(blockProperties),
      });
    };
  }

  return { widget, viewModel };
};
