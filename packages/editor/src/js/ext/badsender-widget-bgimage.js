'use strict';

const ko = require('knockout');
const console = require('console');
const { TRANSPARENT_GIF, isImageUnset } = require('./quality/ownership');

// we need to declare which paramaters are supported
// so in @supports -ko-blockdefs we can write:
// bgimage {
//   label: Background Image;
//   widget: bgimage;
//   size: 200x100; // <= not used anymore
// }

// other “native” widgets are defined in converter/editor.js
// size is deactivate for now: background-images are used for repeating patterns
const defaultParameters = Object.freeze({
  // size: `100x100`,
});
// The template's own value for this background of the block: the placeholder
// it ships for the client to replace, which counts as no image (the same rule
// as the quality check, see quality/ownership.js).
function templateBackground(vm, block, prop) {
  const type = ko.unwrap(block.type);
  const def = (ko.unwrap(vm.blockDefs) || []).find(
    (blockDef) => ko.unwrap(ko.unwrap(blockDef).type) === type
  );
  const options = def && ko.unwrap(ko.unwrap(def).bgOptions);
  return options ? ko.unwrap(options[prop]) : undefined;
}

const isValidSize = (size) => /(\d+)x(\d+)/.test(size.trim());

function html(propAccessor, onfocusbinding, parameters) {
  return `
    <input size="7" value="nothing" type="hidden" id="${propAccessor}" data-bind="value: ${propAccessor}, ${onfocusbinding}" />
    <div class="bgimage-button-group">
      <button class="bgimage-button-primary" data-bind="button: { css: { disabledButton: $root.hasImageByProp('${propAccessor}') }, disabled: $root.hasImageByProp('${propAccessor}'), icons: {primary: 'lucide lucide-image'} }, text: $root.t('widget-bgimage-button'), click: function(element, evt) { $root.openDialogGallery('${propAccessor}', '${parameters}', element); }">pick an image</button>
      <button class="bgimage-button-reset" data-bind="button: { css: { disabledButton: !$root.hasImageByProp('${propAccessor}') }, disabled: !$root.hasImageByProp('${propAccessor}'), icons: {primary: 'lucide lucide-trash-2'}, text: false, label: $root.t('widget-bgimage-reset') }, click: $root.resetBgimage.bind($element, '${propAccessor}', '${parameters}');"></button>
    </div>
  `;
}

module.exports = (opts) => {
  const imageRoute = opts.metadata.imagesUrl.images;

  function widget($, ko, kojqui) {
    return {
      widget: 'bgimage',
      defaultParameters,
      html,
    };
  }

  function viewModel(vm) {
    vm.showDialogGallery = ko.observable(false);
    vm.currentBgimage = ko.observable(false);


    vm.hasImageByProp = (prop) => {
      const currentBlock = vm.selectedBlock();
      if (currentBlock?.bgOptions && currentBlock?.bgOptions()?.bgimage) {
        if (prop === 'outlookBgImage' && currentBlock?.bgOptions()?.outlookBgImageVisible && !currentBlock?.bgOptions()?.outlookBgImageVisible()) {
          return false;
        }
        if (prop === 'mobileBgimage' && currentBlock?.bgOptions()?.mobileBgImageChoice && currentBlock?.bgOptions()?.mobileBgImageChoice() !== 'mobile') {
          return false;
        }
        if (prop === 'bgimage' && currentBlock?.bgOptions()?.bgImageChoice && currentBlock?.bgOptions()?.bgImageChoice() !== 'custom') {
          return false;
        }

        const newBgImage = currentBlock?.bgOptions()[prop]();
        return !isImageUnset(
          newBgImage,
          templateBackground(vm, currentBlock, prop)
        );
      }
    };
    vm.setBgImage = (imageName, img, event) => {
      // images have to be on an absolute path
      // => Testing by email needs it that way
      // => ZIP download needs it that way
      vm.currentBgimage()(`${imageRoute}${imageName}`);
      vm.closeDialogGallery();
    };
    vm.resetBgimage = (propAccessor, parameters, blockProperties, event) => {
      blockProperties[propAccessor](TRANSPARENT_GIF);
    };
    vm.openDialogGallery = (
      propAccessor,
      parameters,
      blockProperties,
      event
    ) => {
      // to set the right property, store the concerned setter
      vm.currentBgimage(blockProperties[propAccessor].bind(blockProperties));
      vm.showDialogGallery(true);
    };
    vm.closeDialogGallery = () => {
      vm.currentBgimage(false);
      vm.showDialogGallery(false);
    };

    const dialogGalleryOpen = vm.showDialogGallery.subscribe((newValue) => {
      if (newValue === true && vm.mailingGalleryStatus() === false) {
        vm.loadMailingGallery();
        dialogGalleryOpen.dispose();
      }
    });
  }

  return {
    transparentGif: TRANSPARENT_GIF,
    widget,
    viewModel,
  };
};
