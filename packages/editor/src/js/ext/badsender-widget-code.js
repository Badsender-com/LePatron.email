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
//
// A second button opens the email's head CSS. That stylesheet belongs to the
// mailing, not to this block, and it also lives at the bottom of the global
// Style tab — but this is where someone who just pasted markup looks for a way
// to make it responsive. Two entry points, one value: both open the same editor
// on the same observable. The hint under the button says the scope is the whole
// email, so nobody expects it to be per-block.

// The hidden input keeps the property bound (and focus-tracked) the way native
// widgets do, so selecting the block still highlights it in the canvas.
//
// With the template flag off, the block stays — the server keeps accepting the
// markup already stored, so the email remains savable — but it cannot be edited:
// the server refuses any markup the mailing did not already hold
// (packages/server/mailing/html-code-block-guard.js). The button gives way to a
// sentence saying so, rather than letting the user edit and then fail to save.
function html(propAccessor, onfocusbinding, parameters) {
  return `
    <input type="hidden" id="${propAccessor}" data-bind="value: ${propAccessor}, ${onfocusbinding}" />
    <div class="html-code-widget">
      <button class="html-code-widget__button" data-bind="visible: $root.isHtmlBlockEditable(), button: { icons: { primary: 'lucide lucide-code-2' } }, text: $root.t('widget-code-edit'), click: function(blockProperties, evt) { $root.openHtmlCodeEditor('${propAccessor}', blockProperties); }">Edit HTML code</button>
      <p class="html-code-widget__disabled" data-bind="visible: !$root.isHtmlBlockEditable(), text: $root.t('widget-code-disabled')"></p>
      <button class="html-code-widget__button html-code-widget__button--secondary" data-bind="visible: $root.isHtmlBlockEditable(), button: { icons: { primary: 'lucide lucide-paintbrush' } }, text: $root.t('widget-code-edit-css'), click: function() { $root.openHeadCssEditor(); }">Edit the email CSS</button>
      <p class="html-code-widget__hint" data-bind="visible: $root.isHtmlBlockEditable(), text: $root.t('widget-code-css-hint')"></p>
      <button class="html-code-widget__button html-code-widget__button--secondary" data-bind="visible: $root.isHtmlBlockEditable(), button: { icons: { primary: 'lucide lucide-layout-template' } }, text: $root.t('widget-code-compose'), click: function(blockProperties, evt) { $root.openBlockBuilder('${propAccessor}', blockProperties); }">Compose a block</button>
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

    vm.isHtmlBlockEditable = function () {
      return Boolean(vm.metadata && vm.metadata.htmlBlockEnabled);
    };

    // Set by the Vue modal when it mounts, like toggleHtmlCodeModal above.
    vm.toggleBlockBuilderModal = null;

    // The builder writes generated markup into the very same property the code
    // editor writes by hand. One block type, two ways to fill it — so export,
    // the inliner's protected zone, the sanitised preview and the template flag
    // are the machinery already in production.
    vm.openBlockBuilder = function (propAccessor, blockProperties) {
      if (!vm.isHtmlBlockEditable()) return;
      if (typeof vm.toggleBlockBuilderModal !== 'function') return;
      if (!blockProperties || !blockProperties[propAccessor]) return;

      vm.toggleBlockBuilderModal(true, {
        accessor: blockProperties[propAccessor].bind(blockProperties),
      });
    };

    vm.openHtmlCodeEditor = function (propAccessor, blockProperties) {
      if (!vm.isHtmlBlockEditable()) return;
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
