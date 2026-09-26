'use strict';

const { BLOCK_BUILDER_BLOCK } = require('./html-code-block/block-types.js');

// Widget for the `blockBuilder` property type, declared by the injected block
// definitions as `builderHtml { widget: blockBuilder; }`.
//
// Same shape as badsender-widget-code.js — a hidden input keeping the property
// bound and focus-tracked, plus a button opening a modal — for the same reason:
// #main-toolbox is 400px wide, and composing a layout needs room. What differs
// is the promise. Here the user never sees the HTML, so there is no "edit" verb,
// only "compose", and reopening lands back in the composition rather than in a
// code editor.

function html(propAccessor, onfocusbinding, parameters) {
  return `
    <input type="hidden" id="${propAccessor}" data-bind="value: ${propAccessor}, ${onfocusbinding}" />
    <div class="html-code-widget">
      <button class="html-code-widget__button" data-bind="visible: $root.isBlockBuilderEditable(), button: { icons: { primary: 'lucide lucide-layout-template' } }, text: $root.t('widget-block-builder-compose'), click: function(blockProperties, evt) { $root.openBlockBuilder('${propAccessor}', blockProperties); }">Compose a block</button>
      <p class="html-code-widget__disabled" data-bind="visible: !$root.isBlockBuilderEditable(), text: $root.t('widget-block-builder-disabled')"></p>
    </div>
  `;
}

module.exports = () => {
  function widget() {
    return {
      widget: BLOCK_BUILDER_BLOCK.widget,
      defaultParameters: Object.freeze({}),
      html,
    };
  }

  function viewModel(vm) {
    // Set by the Vue modal when it mounts (same handshake as
    // vm.toggleHtmlCodeModal). Guarded so a click before the modal mounts is a
    // no-op rather than a TypeError.
    vm.toggleBlockBuilderModal = null;

    // Its own flag, independent of htmlBlockEnabled: a client can be given the
    // builder without the raw HTML block — and that client is precisely the one
    // who wants the guard rails.
    vm.isBlockBuilderEditable = function () {
      return Boolean(vm.metadata && vm.metadata[BLOCK_BUILDER_BLOCK.flag]);
    };

    vm.openBlockBuilder = function (propAccessor, blockProperties) {
      if (!vm.isBlockBuilderEditable()) return;
      if (typeof vm.toggleBlockBuilderModal !== 'function') return;
      if (!blockProperties || !blockProperties[propAccessor]) return;

      // Two accessors: the markup the block exports, and the state the builder
      // reopens from. The second is declared in the injected block definitions
      // (see inject-synthetic-blocks.js) and is absent only on a block stored
      // before it existed — which the modal treats as "nothing to reopen".
      const stateProperty = blockProperties[BLOCK_BUILDER_BLOCK.stateProperty];

      vm.toggleBlockBuilderModal(true, {
        accessor: blockProperties[propAccessor].bind(blockProperties),
        stateAccessor:
          typeof stateProperty === 'function'
            ? stateProperty.bind(blockProperties)
            : null,
      });
    };
  }

  return { widget, viewModel };
};
