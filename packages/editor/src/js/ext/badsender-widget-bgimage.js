'use strict';

const ko = require('knockout');
const console = require('console');

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
const transparentGif = `data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==`;

const isValidSize = (size) => /(\d+)x(\d+)/.test(size.trim());

function html(propAccessor, onfocusbinding, parameters) {
  return `
    <input size="7" type="hidden" value="nothing" id="${propAccessor}" data-bind="value: ${propAccessor}, ${onfocusbinding}" />
    <button data-bind="text: $root.t('widget-bgimage-button'), click: $root.openDialogGallery.bind($element, '${propAccessor}', '${parameters}');">pick an image</button>
    <button data-bind="click: $root.resetBgimage.bind($element, '${propAccessor}', '${parameters}'), button: {icons: {primary: 'fa fa-eraser'}, text: false, label: $root.t('widget-bgimage-reset') }"></button>
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
    vm.setBgImage = (imageName, img, event) => {
      console.log({ imageName });
      console.log({ img });
      console.log({ event });
      // images have to be on an absolute path
      // => Testing by email needs it that way
      // => ZIP download needs it that way
      vm.currentBgimage()(`${imageRoute}${imageName}`);
      vm.closeDialogGallery();
    };
    vm.resetBgimage = (propAccessor, parameters, blockProperties, event) => {
      console.log({ blockProperties });
      console.log({ propAccessor });
      console.log({ parameters });
      blockProperties[propAccessor](transparentGif);
    };
    vm.openDialogGallery = (
      propAccessor,
      parameters,
      blockProperties,
      event
    ) => {
      console.log({ propAccessor });
      console.log({ parameters });
      console.log({ blockProperties });
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
    widget,
    viewModel,
  };
};
