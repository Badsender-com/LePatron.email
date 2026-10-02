'use strict';

// The background image widget and the quality check must agree on what "no
// image" is: the widget offers to pick an image exactly where the check
// reports one missing.

const ko = require('knockout');
const { mapValues } = require('lodash');

const widgetBgImage = require('../../../packages/editor/src/js/ext/badsender-widget-bgimage.js');
const {
  TRANSPARENT_GIF,
} = require('../../../packages/editor/src/js/ext/quality/ownership.js');

const TEMPLATE_BG = 'https://cdn.test/template/bg.png';

function hasImage(bgimage) {
  const vm = {
    blockDefs: [{ type: 'heroBlock', bgOptions: { bgimage: TEMPLATE_BG } }],
  };
  const block = {
    type: ko.observable('heroBlock'),
    bgOptions: ko.observable(
      mapValues({ bgImageChoice: 'custom', bgimage }, (v) => ko.observable(v))
    ),
  };
  vm.selectedBlock = ko.observable(block);
  widgetBgImage({ metadata: { imagesUrl: { images: '/img/' } } }).viewModel(vm);
  return vm.hasImageByProp('bgimage');
}

describe('background image widget', () => {
  it("takes the template's default image for no image", () => {
    expect(hasImage(TEMPLATE_BG)).toBe(false);
  });

  it('takes the blank it resets an image to for no image', () => {
    expect(hasImage(TRANSPARENT_GIF)).toBe(false);
  });

  it("takes the client's own image for an image", () => {
    expect(hasImage('https://cdn.test/mine.png')).toBe(true);
  });
});
