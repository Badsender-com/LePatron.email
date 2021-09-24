'use strict';

const ko = require('knockout');
// https://colorpicker.easylogic.studio/
// https://www.npmjs.com/package/@easylogic/colorpicker
const ColorPickerUI = require('@easylogic/colorpicker');

const { eventsHub, WINDOW_CLICK } = require('../badsender-events-hub.js');

// Original mosaico use evol-colorpicker
// • http://evoluteur.github.io/colorpicker/
// It's in design too far from the tinyMCE color-picker
// • https://github.com/Badsender/mosaico/issues/29
// → try to use another one

// Color-picker binding is defined in "bindings/colorpicker.js"
// • then registered in "ko-bindings.js"
// • then it is called in the "converter/editor.js"
// • it will translate any "color" property to a call to "colorpicker"
//   https://github.com/Badsender/mosaico/blob/master/src/js/converter/editor.js#L70

// to understand `deprecatedVM` see
// https://knockoutjs.com/documentation/custom-bindings.html#the-update-callback

// event.target !== el && !el.contains(event.target)

// https://developer.mozilla.org/en-US/docs/Web/API/Element/closest

console.log(`ColorPickerUI`);

const PICKER_CLASS = `badsender-colorpicker__picker`;
const PICKER_CLASS_HIDDEN = `badsender-colorpicker__picker--hidden`;
const NOT_HIDDEN_PICKER_QUERY = `.${PICKER_CLASS}:not(.${PICKER_CLASS_HIDDEN})`;
const CLEAR_BUTTON_CLASS = `badsender-colorpicker__clear-button`;
const CLEAR_BUTTON_ICON = `<i class="fa fa-times"></i>`;

const colorpicker = {
  init($colorInput, valueAccessor, allBindings, deprecatedVM, bindingContext) {
    const va = valueAccessor();
    const initialColor = va.color();

    // In order to have a correct dependency tracking in "ifSubs" we have to ensure we use a single "computed" for each editable
    // property. Given this binding needs 2 of them, we create a new wrapping computed so to "proxy" the dependencies.
    // var newDO = ko.computed({
    //   read: value,
    //   write: value,
    //   disposeWhenNodeIsRemoved: element
    // });
    const $container = document.createElement(`div`);
    $container.classList.add(`badsender-colorpicker`);

    const $bucket = document.createElement(`div`);
    $bucket.classList.add(`badsender-colorpicker__bucket`);
    $bucket.style.backgroundColor = initialColor;

    const $picker = document.createElement(`div`);
    $picker.classList.add(PICKER_CLASS, PICKER_CLASS_HIDDEN);

    const $clearButton = document.createElement(`button`);
    $clearButton.classList.add(CLEAR_BUTTON_CLASS);
    $clearButton.innerHTML = CLEAR_BUTTON_ICON;
    $clearButton.addEventListener(`click`, clearColor, { passive: true });

    $container.appendChild($bucket);
    $container.appendChild($picker);

    $colorInput.after($container);
    $colorInput.after($clearButton);
    $colorInput.setAttribute(`readonly`, ``);
    $colorInput.value = initialColor;

    // onChange seems to trigger `click` event on input
    // • prevent this
    let isPicking = false;
    const picker = ColorPickerUI.create({
      container: $picker,
      position: `inline`,
      autoHide: false,
      type: `sketch`,
      onChange: (color) => {
        $bucket.style.backgroundColor = color;
        va.color(color);
        $colorInput.value = color;
        console.log(color);
        isPicking = true;
        return false;
      },
    });

    function clearColor(event) {
      va.color(``);
      $colorInput.value = ``;
      $bucket.style.backgroundColor = ``;
    }

    function showColorPicker(event) {
      // console.log(`SHOW_COLOR_PICKER`, isPicking, event)
      if (isPicking) return (isPicking = false);
      event.preventDefault();
      const openedPickers = document.querySelectorAll(NOT_HIDDEN_PICKER_QUERY);
      // close any other picker
      [...openedPickers]
        .filter(($pickerWrapper) => $pickerWrapper !== $picker)
        .forEach(($pickerWrapper) =>
          $pickerWrapper.classList.add(PICKER_CLASS_HIDDEN)
        );
      $picker.classList.toggle(PICKER_CLASS_HIDDEN);
    }
    function closePickerOnGlobalClick(event) {
      if (event.detail == null) return;
      const { target } = event.detail;
      const isPickerClick = target === $picker || $picker.contains(target);
      const isBucketClick = target === $bucket;
      const isInputClick = target === $colorInput;
      const isHandled = isPickerClick || isBucketClick || isInputClick;
      if (isHandled) return;
      $picker.classList.add(PICKER_CLASS_HIDDEN);
    }

    $colorInput.addEventListener(`click`, showColorPicker, { passive: false });

    $bucket.addEventListener(`click`, showColorPicker, { passive: false });
    eventsHub.addEventListener(WINDOW_CLICK, closePickerOnGlobalClick, false);

    ko.utils.domNodeDisposal.addDisposeCallback($colorInput, (event) => {
      picker.destroy();
      $colorInput.removeEventListener(`click`, showColorPicker, {
        passive: false,
      });
      $clearButton.removeEventListener(`click`, clearColor, { passive: true });
      $bucket.removeEventListener(`click`, showColorPicker, { passive: false });
      eventsHub.removeEventListener(
        WINDOW_CLICK,
        closePickerOnGlobalClick,
        false
      );
      $container.remove();
    });
  },
  update(
    $colorInput,
    valueAccessor,
    allBindings,
    deprecatedVM,
    bindingContext
  ) {
    console.log(`update colorpicker`);
  },
};

ko.bindingHandlers.colorpicker = colorpicker;
