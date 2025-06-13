'use strict';
import Konva from 'konva';
import { EditorCropper } from './image-editor-cropper';
import { EditorText } from './image-editor-text';
import { EditorFilters } from './image-editor-filters';

const $ = require('jquery');
const raf = window.requestAnimationFrame;
const ACTIVE_CLASS = `editor-active`;

const Editor = {
    // Canva (KonvaJS elements and stored values)
    container: null,
    stage: null,
    layer: null,
    transformer: null,
    children: null,
    baseImage: {
        width: null,
        height: null,
        rotation: null,
        pixelSize: null,
        crop: null,
    },
    image: null,
    cropper: null,
    textHandler: null,
    filtersHandler: null,
    ratio: null,
    cropping: false,
    selection: null,

    // Actions (HTML elements)
    wrapper: null,
    cancel: null,
    submit: null,
    reset: null,
    text: null,
    inputWidth: null,
    inputHeight: null,
    flipX: null,
    flipY: null,
    rotateRight: null,
    rotateLeft: null,
    cornerRadius: null,
    textColor: null,
    textStyle: null,
    textSize: null,
    textFont: null,
    crop: null,
    cropReset: null,
    cropCancel: null,
    cropSubmit: null,
    lastCrop: null,
    cropToolbar: null,
    toolbar: null,
    fileAction: null,
    fileInput: null,
    elementActions: null,
    imageActions: null,
    textActions: null,
    cropActions: null,
    colorPicker: null,
    zoomInput: null,
    zoomIn: null,
    zoomOut: null,
    backgroundImage: null,
    backgroundImageReset: null,
    backgroundImageCancel: null,
    backgroundImageSave: null,

    // Misc
    deferredCallback: null,
    abort: null,
    data: null,
    file: null,
    messages: null,
    baseAnchors: [],
    cornerAnchors: [],
    middleAnchors: [],
}

/**
 * Inits editor properties, draws the canvas stage and bind features handlers.
 * The editor is injected as html content into the page.
 * @param {JQuery.Deferred<any, any, any>} next - Deferred callback called when this context ends.
 * @param {JQuery.Deferred<any, any, any>} abort - Deferred callback called when this context exists.
 * @param {any} data - Data of the uploaded files as an object.
 * @param {object} file - Data of the uploaded file as an object containing its index, name and type.
 * @param {object} messages - Translated messages used in the editor as an object.
 * @param {any} parent - The html parent of the editor frame.
 * @param {HTMLImageElement} image - The uploaded image as a html element.
 */
export function OpenEditor(next, abort, data, file, messages, parent, image) {
  Editor.deferredCallback = next;
  Editor.messages = messages;
  Editor.abort = abort;
  Editor.data = data;
  Editor.file = file;
  Editor.children = [];
  Editor.baseAnchors = ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'];
  Editor.cornerAnchors = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  Editor.middleAnchors = ['top-center', 'middle-right', 'middle-left', 'bottom-center'];
  initEditor(parent, image.src, messages);
}

/**
 * Loads the base image, draws the stage one time and creates / initializes every element required by the editor.
 * @param {any} parent - The html parent of the editor frame.
 * @param {string} src - The base image source.
 * @param {object} messages - Translated messages used in the editor as an object.
 */
function initEditor(parent, src, messages) {
  // Create an element that contains the HTML content of the modal
  const modalContent = modal(Editor.messages);

  // Create a temporary container in which we insert the HTML
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = modalContent;

  // We add the container after the parent element
  parent.after(tempContainer.firstElementChild)

  const container = document.getElementById('konva-editor'); // Canvas area only
  const stage = new Konva.Stage({
      container: container,
      width: container.clientWidth,
      height: container.clientHeight,
      draggable: true,
  });

  // The layer for the image
  const mainLayer = new Konva.Layer();

  // A transformer allows us to move and rotate objects within the canvas.
  // We want to keep the ratio and only do free resize with middle edge anchors.
  const transformer = new Konva.Transformer({ keepRatio: true });

  const uploadedImage = new Image();
  uploadedImage.src = src;

  const mainImage = new Konva.Image({
      image: uploadedImage,
      draggable: true,
  });

  mainLayer.add(transformer);
  transformer.nodes([mainImage]);

  // Everything is trully created / initialized after the base image if loaded.
  uploadedImage.onload = function() {
    mainImage.x(stage.width() / 2);
    mainImage.y(stage.height() / 2);
    mainImage.offsetX(mainImage.width() / 2);
    mainImage.offsetY(mainImage.height() / 2);
    mainLayer.add(mainImage);
    mainLayer.draw();

    // The layer has to be drawn before being added to its stage
    stage.add(mainLayer);

    const $wrapper = $('#editor-wrapper');

    // Canva
    Editor.container = container;
    Editor.stage = stage;
    Editor.layer = mainLayer;
    Editor.transformer = transformer;
    Editor.children = [];
    Editor.baseImage = {
        width: mainImage.width(),
        height: mainImage.height(),
        rotation: mainImage.rotation(),
        pixelSize: mainImage.pixelSize(),
        crop: {
          x: mainImage.cropX(),
          y: mainImage.cropY(),
          width: mainImage.cropWidth(),
          height: mainImage.cropHeight(),
        }
    };
    Editor.image = mainImage;

    // Actions
    Editor.wrapper = $wrapper;
    Editor.cancel = $wrapper.find(`.js-actions-cancel`);
    Editor.submit = $wrapper.find(`.js-actions-submit`);
    Editor.reset = $wrapper.find(`.js-actions-reset`);
    Editor.text = $wrapper.find(`.js-actions-text`);
    Editor.inputWidth = $wrapper.find(`#resize-width`);
    Editor.inputHeight = $wrapper.find(`#resize-height`);
    Editor.flipX = $wrapper.find(`.js-actions-mirror-horizontal`);
    Editor.flipY = $wrapper.find(`.js-actions-mirror-vertical`);
    Editor.rotateRight = $wrapper.find(`.js-actions-rotate-right`);
    Editor.rotateLeft = $wrapper.find(`.js-actions-rotate-left`);
    Editor.cornerRadius = $wrapper.find(`#corner-radius`);
    Editor.textColor = $wrapper.find(`#text-color`);
    Editor.textStyle = $wrapper.find(`#text-style`);
    Editor.textSize = $wrapper.find(`#text-size`);
    Editor.textFont = $wrapper.find(`#text-font`);
    Editor.crop = $wrapper.find('.js-actions-crop');
    Editor.cropReset = $wrapper.find('.js-actions-crop-reset');
    Editor.cropCancel = $wrapper.find('.js-actions-crop-cancel');
    Editor.cropSubmit = $wrapper.find('.js-actions-crop-submit');
    Editor.cropToolbar = $wrapper.find('.js-crop-toolbar');
    Editor.ratioToolbar = $wrapper.find('.js-ratio-toolbar');
    Editor.toolbar = $wrapper.find('.js-toolbar');
    Editor.fileAction = $wrapper.find('#js-actions-upload');
    Editor.fileInput = $wrapper.find('#image-upload');
    Editor.elementActions = $wrapper.find('#selected-element-actions');
    Editor.imageActions = $wrapper.find('#selected-image-actions');
    Editor.textActions = $wrapper.find('#selected-text-actions');
    Editor.cropActions = $wrapper.find('#crop-actions');
    Editor.zoomInput = $wrapper.find('#stage-zoom');
    Editor.zoomIn = $wrapper.find('.js-actions-zoomin');
    Editor.zoomOut = $wrapper.find('.js-actions-zoomout');
    Editor.backgroundImage = $wrapper.find('.js-actions-background-image');
    Editor.backgroundImageReset = $wrapper.find('#image-background-reset');
    Editor.backgroundImageCancel = $wrapper.find('#image-background-cancel');
    Editor.backgroundImageSave = $wrapper.find('#image-background-save');

    Editor.inputWidth.val(mainImage.width());
    Editor.inputHeight.val(mainImage.height());

    Editor.transformer.on('transform', function () {
        Editor.inputWidth.val(Math.round(Editor.transformer.width()));
        Editor.inputHeight.val(Math.round(Editor.transformer.height()));
    });

    Editor.image.cache();
    Editor.selection = Editor.image;
    Editor.transformer.moveToTop();

    Editor.colorPicker = Editor.wrapper.find('#text-color');

    Editor.wrapper.find('#selected-element-type').text(Editor.selection.getClassName());
    hideTextActions(true);

    Editor.zoomInput.val("100");

    // Requests the browser to render the first frame to make the editor visible
    raf(() => Editor.wrapper.addClass(ACTIVE_CLASS));

    // Advanced features have to be initialized after the stage is drawn at least one time
    Editor.cropper = EditorCropper(Editor, { handleStageZooming, zoomStageToScale });
    Editor.textHandler = EditorText(Editor);
    Editor.filtersHandler = EditorFilters(Editor, messages);

    // Binds buttons and inputs actions via event handlers
    bindHandlers();
  }
}

/**
 * Binds every button, input or html element that will be updated to its handler.
 * Also prevents some event propagation to avoid recursive calls and unintended actions.
 */
function bindHandlers() {
    Editor.stage.on('wheel', (e) => handleStageZooming(e));
    Editor.cancel.on('click', () => clean(Editor.abort));
    Editor.submit.on('click', () => save());
    Editor.reset.on('click', () => reset());
    Editor.text.on('click', () => { Editor.textHandler.addText(); hideImageActions(true); hideTextActions(false); updateElementActions(false); updateTextActions(); });
    Editor.cornerRadius.on('input', () => handleCornerRadius());
    Editor.inputWidth.on('input', () => setSize(Editor.inputWidth.val(), Editor.inputHeight.val()));
    Editor.inputHeight.on('input', () => setSize(Editor.inputWidth.val(), Editor.inputHeight.val()));
    Editor.flipX.on('click', () => flipX());
    Editor.flipY.on('click', () => flipY());
    Editor.rotateRight.on('click', () => rotate(90));
    Editor.rotateLeft.on('click', () => rotate(-90));
    Editor.crop.on('click', () => startCropping());
    Editor.cropReset.on('click', () => stopCropping(false, true));
    Editor.cropCancel.on('click', () => stopCropping(false, false));
    Editor.cropSubmit.on('click', () => stopCropping(true, false));
    Editor.stage.on("pointerdown", (e) => handleSelection(e));
    Editor.fileAction.on('click', () => Editor.fileInput.trigger('click'));
    Editor.fileInput.on('click', (e) => e.stopPropagation()); // To avoid recursive calls
    Editor.fileInput.on('change', (e) => handleFilePicked(e));

    Editor.inputWidth.on('keydown', (e) => e.stopPropagation()); // Prevents selected element deletion when typing inside the width input
    Editor.inputHeight.on('keydown', (e) => e.stopPropagation()); // Prevents selected element deletion when typing inside the height input
    Editor.textSize.on('keydown', (e) => e.stopPropagation()); // Prevents selected element deletion when typing inside the text size input

    Editor.zoomIn.on('click', () => handleManualZoom(true));
    Editor.zoomOut.on('click', () => handleManualZoom(false));
    Editor.backgroundImage.on('click', () => toggleBackgroundMenu());
    Editor.backgroundImageCancel.on('click', () => toggleBackgroundMenu(null));
    Editor.backgroundImageSave.on('click', () => setImageBackground());
    Editor.backgroundImageReset.on('click', () => resetImageBackground());

    window.addEventListener('keydown', (e) => handleDelete(e));
}

/**
 * Sets the size of the selected element and calculates its new offsets.
 * @param {float} width - The new width as a floating value.
 * @param {float} height - The new height as a floating value.
 */
function setSize(width, height) {
  if (Editor.selection !== null) {
    Editor.selection.width(stringToNumber(width, 1));
    Editor.selection.height(stringToNumber(height, 1));
    Editor.selection.offsetX(width / 2);
    Editor.selection.offsetY(height / 2);
  }
}

/**
 * Mirrors the selected element on the X axis by inverting its horizontal scale.
 */
function flipX() {
    if (Editor.selection !== null) {
      Editor.selection.scaleX(Editor.selection.scaleX() * -1);
    }
}

/**
 * Mirrors the selected element on the Y axis by inverting its vertical scale.
 */
function flipY() {
  if (Editor.selection !== null) {
    Editor.selection.scaleY(Editor.selection.scaleY() * -1);
  }
}

/**
 * Rotates the selected element by the given degrees values.
 * KonvaJS works with 180° range (from 180° to -180°).
 * @param {float} degrees - The degrees as a floating value.
 */
function rotate(degrees) {
  if (Editor.selection !== null) {
    Editor.selection.rotate(degrees);
  }
}

/**
 * Inits the cropping layer and displays its toolbar.
 */
function startCropping() {
  if (Editor.selection === Editor.image) {
    updateElementActions(true);
    hideElementActions(true);
    hideImageActions(true);
    Editor.cropping = true;
    Editor.cropper.start();
    Editor.toolbar.addClass('editor-hidden');
    Editor.cropToolbar.removeClass('editor-hidden');
    Editor.cropActions.removeClass('editor-hidden');
  }
}

/**
 * Stops the crop and hides its toolbar.
 * If the given value is false then the image is restored to its old size.
 * @param {boolean} doCrop - Validates or not the crop.
 * @param {boolean} reset - Resets or not the crop.
 */
function stopCropping(doCrop, reset) {
  Editor.cropping = false;
  Editor.cropper.stop(doCrop, reset);
  Editor.toolbar.removeClass('editor-hidden');
  Editor.cropToolbar.addClass('editor-hidden');
  Editor.cropActions.addClass('editor-hidden');
  updateElementActions(false);
  hideElementActions(false);
  hideImageActions(false);
}

/**
 * Handles selected image corner radius via a range input (= slider).
 * Caches the selected image after update.
 */
function handleCornerRadius() {
  if (!Editor.selection instanceof Konva.Image || Editor.selection === null) return;

  Editor.selection.cornerRadius(stringToNumber(Editor.cornerRadius.val(), 0));
  Editor.selection.cache();
}

/**
 * Handles element selection and fires UI updates.
 * @param {any} event - The event fired when clicking on the page window.
 */
function handleSelection(event) {
  if (Editor.cropping === true) return;
  if (event.target === Editor.selection) return;
  if (event.target.attrs.name?.includes("_anchor")) return; // Transformer anchors

  if (event.target !== Editor.stage) {
    Editor.selection = event.target;
    Editor.transformer.nodes([Editor.selection]);
    Editor.transformer.moveToTop(); // Prevents transformer from being hidden by other elements

    if (Editor.selection instanceof Konva.Text) {
      Editor.transformer.enabledAnchors(Editor.middleAnchors);
      Editor.transformer.flipEnabled(false);
      hideTextActions(false);
      hideImageActions(true);
      updateTextActions();
      toggleBackgroundMenu(false);
    } else if (Editor.selection instanceof Konva.Image) {
      Editor.transformer.enabledAnchors(Editor.baseAnchors);
      Editor.transformer.flipEnabled(true);

      updateBackgroundMenu();
      hideImageActions(false);
      hideTextActions(true);
      Editor.cornerRadius.val(Editor.selection.cornerRadius());
      Editor.filtersHandler.updateFiltersSelection(true);

      Editor.crop.prop('disabled', Editor.selection !== Editor.image);
    }
    else {
      Editor.transformer.enabledAnchors(Editor.baseAnchors);
      Editor.transformer.flipEnabled(true);
      Editor.cornerRadius.val(0);
      hideImageActions(true);
      hideTextActions(true);
    }

    Editor.transformer.moveToTop();
    updateElementActions(false);
    return;
  }

  Editor.transformer.enabledAnchors(Editor.baseAnchors);
  Editor.transformer.nodes([]);
  Editor.selection = null;
  Editor.cornerRadius.val(0);
  hideImageActions(true);
  hideTextActions(true);
  updateElementActions(true);
  toggleBackgroundMenu(false);
}

/**
 * Handles element deletion.
 * Prevents the base image from being deleted.
 * @param {KeyboardEvent} event - The event fired when the user presses a keybind.
 */
function handleDelete(event) {
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (Editor.selection === null || Editor.selection === Editor.image) return;
  if (!Editor.selection.visible()) return; // Prevents deletion when editing a text or when cropping

  Editor.transformer.nodes([]);
  Editor.selection.destroy();
  Editor.children = Editor.children.filter(_node => _node !== Editor.selection);
  Editor.stage.batchDraw();
  Editor.selection = null;
  hideImageActions(true);
  hideTextActions(true);
  toggleBackgroundMenu(false);
}

/**
 * Handles image upload (png only) and loads it to the stage.
 * @param {any} event - The event fired by the file selector containing the uploaded file as a byte array.
 */
function handleFilePicked(event) {
  event.stopPropagation();
  const files = event.target.files;
  const fileReader = new FileReader();
  fileReader.addEventListener("load", () => {
    const imageUrl = fileReader.result;
    const newImage = new Image();
    newImage.src = imageUrl;
    newImage.onload = () => {
      const image = new Konva.Image({
        draggable: true,
        image: newImage,
      });
      image.setAttrs({
        x: Editor.stage.width() / 2,
        y: Editor.stage.height() / 2,
        offsetX: newImage.width / 2,
        offsetY: newImage.height / 2,
      });
      image.cache();
      Editor.layer.add(image);
      Editor.transformer.nodes([image]);
      Editor.transformer.moveToTop();
      Editor.children.push(image);
      Editor.selection = image;
      Editor.inputWidth.val(Math.round(Editor.transformer.width()));
      Editor.inputHeight.val(Math.round(Editor.transformer.height()));
      Editor.cornerRadius.val(image.cornerRadius());
      hideImageActions(false);
      hideTextActions(true);
      updateElementActions(false);
      updateBackgroundMenu();
      Editor.transformer.enabledAnchors(Editor.baseAnchors);
      Editor.filtersHandler.updateFiltersSelection(true);
      Editor.crop.prop('disabled', Editor.image !== Editor.selection);
    };
  });
  fileReader.readAsDataURL(files[0]);
}

/**
 * Handles stage zoom in and zoom out.
 * The zoom is relative to the cursor position on the stage.
 * This method is from the KonvaJS doc (https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html#sidebar)
 * @param {any} e - The wheel event which fired the handler.
 */
function handleStageZooming(e) {
  if (Editor.cropping === true) return;

  const scaleBy = 1.05;
  e.evt.preventDefault();

  let direction = e.evt.deltaY > 0 ? -1 : 1;

  // If the user holds ctrl key the direction is inverted
  if (e.evt.ctrlKey) {
    direction = -direction;
  }

  const currentZoom = Math.round(Editor.stage.scaleX() * 100);
  if ((currentZoom === 0 && direction == -1) || (currentZoom >= 500 && direction == 1)) return;

  const oldScale = Editor.stage.scaleX();

  zoomStageToScale(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, false);
}

/**
 * Zoom stage to the given scale.
 * @param {float} scale - The new scale of the sage as a floating value.
 * @param {boolean} centered - If true, the scale will follow the center of the stage. Otherwise, the scale will follow the user's pointer.
 */
function zoomStageToScale(scale, centered) {
  const oldScale = Editor.stage.scaleX();
  const pointer = Editor.stage.getPointerPosition();

  const mousePointTo = {
    x: (pointer.x - Editor.stage.x()) / oldScale,
    y: (pointer.y - Editor.stage.y()) / oldScale,
  };

  Editor.stage.scale({ x: scale, y: scale });

  let newPos = {
    x: 0,
    y: 0,
  };

  if (centered === true) {
    const centerX = Editor.stage.width() / 2;
    const centerY = Editor.stage.height() / 2;

    newPos = {
      x: Editor.stage.x() + (centerX * oldScale) - (centerX * scale),
      y: Editor.stage.y() + (centerY * oldScale) - (centerY * scale),
    };
  } else {
    newPos = {
      x: pointer.x - mousePointTo.x * scale,
      y: pointer.y - mousePointTo.y * scale,
    };
  }

  Editor.stage.position(newPos);
  Editor.zoomInput.val(Math.round(scale * 100));
}

/**
 * Handles zoom-in and zoom-out buttons clicks.
 * @param {boolean} zoomIn - The direction of the zoom.
 */
function handleManualZoom(zoomIn) {
  const scaleBy = zoomIn ? 0.05 : -0.05;
  const currentZoom = Editor.stage.scaleX();
  if ((currentZoom === 0 && zoomIn === false) || (currentZoom >= 500 && zoomIn === true)) return;
  zoomStageToScale(currentZoom + scaleBy, true);
}

/**
 * Toggles the menu and updates its values depending on the selected element.
 * @param {boolean} toggled - Whether to show or not the menu.
 */
function toggleBackgroundMenu(toggled) {
  const menu = Editor.wrapper.find('#image-background-menu');

  if (toggled === null) {
    if (menu.hasClass('editor-hidden')) menu.removeClass('editor-hidden');
    else menu.addClass('editor-hidden');

    updateBackgroundMenu();
    return;
  }

  if (toggled === false) {
    menu.addClass('editor-hidden');
  }
  else {
    menu.removeClass('editor-hidden');
  }

  updateBackgroundMenu();
}

/**
 * Updates the color picker value with depending on the selected element fill property.
 */
function updateBackgroundMenu() {
  const colorpicker = Editor.wrapper.find('#image-background-color');
  if (Editor.selection instanceof Konva.Image) {
    colorpicker.val(Editor.selection.fill());
  }
  else {
    colorpicker.val(undefined);
  }
}

/**
 * Resets the selected image background color to transparent.
 */
function resetImageBackground() {
  if (!Editor.selection instanceof Konva.Image) return;

  Editor.selection.fill('transparent');
  Editor.selection.cache();
  toggleBackgroundMenu(false);
}

/**
 * Fills tje selected image with a background color.
 */
function setImageBackground() {
  if (!Editor.selection instanceof Konva.Image) return;

  const colorpicker = Editor.wrapper.find('#image-background-color');
  Editor.selection.fill(colorpicker.val());
  Editor.selection.cache();
  toggleBackgroundMenu(false);
}

/**
 * Resets the stage and image to their default properties.
 */
function reset() {
    Editor.stage.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    Editor.inputWidth.val(Editor.baseImage.width);
    Editor.inputHeight.val(Editor.baseImage.height);
    Editor.image.x(Editor.stage.width() / 2);
    Editor.image.y(Editor.stage.height() / 2);
    Editor.image.width(Editor.baseImage.width);
    Editor.image.height(Editor.baseImage.height);
    Editor.image.scaleX(1);
    Editor.image.scaleY(1);
    Editor.image.rotation(Editor.baseImage.rotation);
    Editor.image.offsetX(Editor.baseImage.width / 2);
    Editor.image.offsetY(Editor.baseImage.height / 2);
    Editor.image.crop({ x: 0, y: 0, width: 0, height: 0 });
    Editor.image.cornerRadius(0);
    Editor.image.filters([]);
    Editor.image.blurRadius(0);
    Editor.image.pixelSize(Editor.baseImage.pixelSize);
    Editor.image.contrast(0);
    Editor.image.brightness(0);
    Editor.image.fill('transparent');
    Editor.lastCrop = null;
    Editor.ratio = "0";
    Editor.transformer.nodes([Editor.image]);
    Editor.selection = Editor.image;
    Editor.children.forEach(node => {
      node.destroy();
    });
    Editor.children = [];
    Editor.cornerRadius.val(0);
    Editor.filtersHandler.reset();
    hideImageActions(false);
    hideTextActions(true);
    updateElementActions(false);
    toggleBackgroundMenu(false);

    Editor.image.cache();
    Editor.zoomInput.val("100");
}

/**
 * Saves the edited image to the gallery.
 */
function save() {
  Editor.transformer.nodes([]);
  const rect = Editor.image.getClientRect();

  Editor.stage.toBlob({
    callback: (blob) => {
      const file = new File([blob], Editor.file.name, { type: Editor.file.type });
      Editor.data.files[Editor.file.index] = file;
      clean();
    },
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
}

/**
 * Removes the editor frame handlers and destroys it.
 * @param {JQuery.Deferred<any, any, any>} deferredCallback - Callback called to continue execution even if the component is destroying (here, used for saving the edited image).
 */
function clean(deferredCallback = Editor.deferredCallback) {
    reset();
    window.removeEventListener('keydown', handleDelete);
    $(document).off(`keyup.bs-cropper`);
    if (!Editor.wrapper.length) {
        return deferredCallback();
    }
    Editor.wrapper.css(`pointer-events`, `none`);
    raf(() => Editor.wrapper.removeClass(ACTIVE_CLASS));
    Editor.wrapper.on(`transitionend`, () => {
        Editor.wrapper.remove();
        deferredCallback();
    });
}

/**
 * Parses the given value into an integer value.
 * If the value couldn't be parsed returns 1.
 * If the value is lower than 1 returns 1.
 * @param {string} value - The int value as a string.
 * @param {int} min - The minimum fallback value.
 * @returns {int} Returns the parsed value as an int.
 */
function stringToNumber(value, min) {
    if (value === undefined) return 1;

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? min : parsed < min ? min : parsed;
}

/**
 * Hides or displays the element actions panel.
 * @param {boolean} hide - Whether to hide or not the element actions panel.
 */
function hideElementActions(hide) {
  if (hide === true) {
    Editor.elementActions.addClass('editor-hidden');
  }
  else {
    Editor.elementActions.removeClass('editor-hidden');
  }
}

/**
 * Hides or displays the image actions panel.
 * @param {boolean} hide - Whether to hide or not the image actions panel.
 */
function hideImageActions(hide) {
  if (hide === true) {
    Editor.imageActions.addClass('editor-hidden');
  }
  else {
    Editor.imageActions.removeClass('editor-hidden');
  }
}

/**
 * Hides or displays the text actions panel.
 * @param {boolean} hide - Whether to hide or not the text actions panel.
 */
function hideTextActions(hide) {
  if (hide === true) Editor.textActions.addClass('editor-hidden');
  else Editor.textActions.removeClass('editor-hidden');
}

/**
 * Updates the text panel inputs (UI).
 */
function updateTextActions() {
  if (Editor.selection instanceof Konva.Text) {
    Editor.textColor.val(Editor.selection.fill());
    Editor.textStyle.val(Editor.selection.fontStyle());
    Editor.textSize.val(Editor.selection.fontSize());
    Editor.textFont.val(Editor.selection.fontFamily());
  }
}

/**
 * Updates the selected element panel buttons, inputs and texts (UI).
 * @param {boolean} disabled - Whether to disable or not the inputs and buttons.
 */
function updateElementActions(disabled) {
  Editor.inputWidth.prop('disabled', disabled);
  Editor.inputHeight.prop('disabled', disabled);
  Editor.flipX.prop('disabled', disabled);
  Editor.flipY.prop('disabled', disabled);
  Editor.rotateLeft.prop('disabled', disabled);
  Editor.rotateRight.prop('disabled', disabled);
  Editor.inputWidth.val(disabled === true ? null : Math.round(Editor.transformer.width()));
  Editor.inputHeight.val(disabled === true ? null : Math.round(Editor.transformer.height()));
  Editor.wrapper.find('#selected-element-type').text(disabled === true ? '-' : Editor.selection?.getClassName() ?? '-');
}

/**
 * Inits the editor html frame and returns it.
 * @param {object} messages - Translated messages used in the editor as an object.
 * @returns {string} - The editor content as html.
 */
const modal = (messages) =>
  `<aside class="editor-frame" id="editor-wrapper">
    <div class="editor-layout">

      <div class="editor-header">
        <h4 class="text-white">${messages.editor_title}</h4>
        <div class="spacer"></div>
        <button class="js-actions-cancel editor-icon-button">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" stroke-width="50"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
        </button>
      </div>

      <div class="editor-layout-inner">

        <div class="v-stack" style="height: 100%; min-width: 220px; padding-top: .5rem; gap: 4px; overflow-y: auto;">

          <!-- Crop selector -->
          <div class="v-stack editor-hidden" id="crop-actions">
            <h4>${messages.editor_crop_panel_title}</h4>
            <div class="h-stack" style="gap: 4px; justify-content: space-between; padding-top: 4px;">
              <p>${messages.editor_size}</p>
              <div class="editor-sizes">
                <label for="resize-width" class="editor-size">
                  <span class="editor-size-label">${messages.input_width}</span>
                  <input class="editor-size-input editor-input-readonly" id="selector-width" name="selector-width" readonly />
                </label>
                <label for="resize-height" class="editor-size">
                  <span class="editor-size-label">${messages.input_height}</span>
                  <input class="editor-size-input editor-input-readonly" id="selector-height" name="selector-height" readonly />
                </label>
              </div>
            </div>
          </div>
          <!-- Crop selector -->

          <!-- Selected element panel -->
          <div class="v-stack editor-bottom-border" id="selected-element-actions">
            <h4>${messages.editor_panel_title}</h4>
            <div class="h-stack" style="gap: 4px; justify-content: space-between; padding-top: 4px;">
              <p>${messages.editor_size}</p>
              <div class="editor-sizes">
                <label for="resize-width" class="editor-size">
                  <span class="editor-size-label">${messages.input_width}</span>
                  <input class="editor-size-input" id="resize-width" name="resize-width" type="number" min="0" />
                </label>
                <label for="resize-height" class="editor-size">
                  <span class="editor-size-label">${messages.input_height}</span>
                  <input class="editor-size-input" id="resize-height" name="resize-height" type="number" min="0" />
                </label>
              </div>
            </div>

            <div class="h-stack" style="width: 100%; justify-content: space-between;">
              <p>${messages.editor_mirror}</p>
              <div class="h-stack" style="gap: 4px;">
                <button class="js-actions-mirror-vertical editor-button editor-button-group" type="button" title="${messages.vertical_mirror}">
                  <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path fill="currentColor" d="M214.059 377.941H168V134.059h46.059c21.382 0 32.09-25.851 16.971-40.971L144.971 7.029c-9.373-9.373-24.568-9.373-33.941 0L24.971 93.088c-15.119 15.119-4.411 40.971 16.971 40.971H88v243.882H41.941c-21.382 0-32.09 25.851-16.971 40.971l86.059 86.059c9.373 9.373 24.568 9.373 33.941 0l86.059-86.059c15.12-15.119 4.412-40.971-16.97-40.971z"></path></svg>
                </button>
                <button class="js-actions-mirror-horizontal editor-button" type="button" title="${messages.horizontal_mirror}">
                  <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M377.941 169.941V216H134.059v-46.059c0-21.382-25.851-32.09-40.971-16.971L7.029 239.029c-9.373 9.373-9.373 24.568 0 33.941l86.059 86.059c15.119 15.119 40.971 4.411 40.971-16.971V296h243.882v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.568 0-33.941l-86.059-86.059c-15.119-15.12-40.971-4.412-40.971 16.97z"></path></svg>
                </button>
              </div>
            </div>

            <div class="h-stack" style="width: 100%; justify-content: space-between;">
              <p>${messages.editor_rotate}</p>
              <div class="h-stack" style="gap: 4px;">
                <button class="js-actions-rotate-left editor-button editor-button-group" type="button" title="${messages.rotate_left}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/></svg>
                </button>
                <button class="js-actions-rotate-right editor-button" type="button" title="${messages.rotate_right}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/></svg>
                </button>
              </div>
            </div>

            <div class="h-stack" style="width: 100%; justify-content: space-between;">
              <p>Type</p>
              <p id="selected-element-type" style="font-style: italic;"></p>
            </div>
          </div>
          <!-- Selected element panel -->

          <!-- Selected image panel -->
          <div class="v-stack" style="height: 100%; margin-top: 2rem;" id="selected-image-actions">
            <div class="v-stack" style="gap: 8px;">
              <h4>${messages.editor_actions_panel_title}</h4>

              <label for="corner-radius" class="v-stack" style="min-width: 150px;">
                <span style="font-size: .9em">${messages.input_corner_radius}</span>
                <input type="range" name="corner-radius" id="corner-radius" min="0" max="100" value="0">
              </label>

              <div class="h-stack" style="gap: 1rem; flex-direction: row-reverse;">
                <div class="v-stack editor-hidden editor-background-menu" id="image-background-menu">
                  <h5>${messages.editor_background_color}</h5>
                  <div class="h-stack editor-flex-center" style="width: 140px; justify-content: space-between;">
                    <p>${messages.editor_color}</p>
                    <input type="color" name="image-background-color" id="image-background-color"/>
                  </div>
                  <div class="h-stack" style="gap: .25rem; justify-content: flex-end; width: 100%;">
                    <button class="editor-icon-button" id="image-background-reset" title="${messages.reset_editor}">
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M480-360v-60q0-25 17.5-42.5T540-480h60L480-360Zm0 161v-85l196-196h85L480-199Zm2 75 353-354q16 4 27.5 15.5T878-435L524-82q-16-5-26.5-15.5T482-124Zm117 44 281-281v85L684-80h-85Zm161 0 120-120v60q0 25-17.5 42.5T820-80h-60Zm71-480h-83q-26-88-99-144t-169-56q-117 0-198.5 81.5T200-480q0 72 32.5 132t87.5 98v-110h80v240H160v-80h94q-62-50-98-122.5T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q129 0 226.5 79.5T831-560Z"/></svg>
                    </button>
                    <div class="spacer"></div>
                    <button class="editor-icon-button" id="image-background-cancel" title="${messages.editor_background_cancel}">
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" stroke-width="50"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
                    </button>
                    <button class="editor-icon-button" id="image-background-save" title="${messages.editor_background_save}">
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>
                    </button>
                  </div>
                </div>

                <button class="js-actions-background-image editor-button" style="margin-bottom: 1rem;" type="button" title="${messages.editor_background_color}">
                  <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M120-574v-85l181-181h85L120-574Zm0-196v-70h70l-70 70Zm527 67q-10-11-21.5-21.5T602-743l97-97h85L647-703ZM220-361l77-77q7 11 14.5 20t16.5 17q-28 7-56.5 17.5T220-361Zm480-197v-2q0-19-3-37t-9-35l152-152v86L700-558ZM436-776l65-64h85l-64 64q-11-2-21-3t-21-1q-11 0-22 1t-22 3ZM120-375v-85l144-144q-2 11-3 22t-1 22q0 11 1 21t3 20L120-375Zm709 83q-8-12-18.5-23T788-335l52-52v85l-11 10Zm-116-82q-7-3-14-5.5t-14-4.5q-9-3-17.5-6t-17.5-5l190-191v86L713-374Zm-233-26q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480ZM160-120v-71q0-34 17-63t47-44q51-26 115.5-44T480-360q76 0 140.5 18T736-298q30 15 47 44t17 63v71H160Zm81-80h478q-2-9-7-15.5T699-226q-36-18-91.5-36T480-280q-72 0-127.5 18T261-226q-8 4-13 11t-7 15Zm239 0Zm0-360Z"/></svg>
                </button>

                <button class="js-actions-crop editor-button" style="margin-bottom: 1rem;" type="button" title="${messages.crop_editor}">
                  <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M680-40v-160H280q-33 0-56.5-23.5T200-280v-400H40v-80h160v-160h80v640h640v80H760v160h-80Zm0-320v-320H360v-80h320q33 0 56.5 23.5T760-680v320h-80Z"/></svg>
                </button>
              </div>
            </div>

            <div class="v-stack" style="gap: 4px; margin-top: 2rem;">
              <h4>${messages.editor_filters_panel_title}</h4>
              <div class="editor-filters-list">
                <button type="button" id="filters-grayscale">${messages.filters_grayscale}</button>
                <button id="filters-blur">${messages.filters_blur}</button>
                <button id="filters-pixelate">${messages.filters_pixelate}</button>
                <button id="filters-contrast">${messages.filters_contrast}</button>
                <button id="filters-brighten">${messages.filters_brighten}</button>
                <button id="filters-invert">${messages.filters_invert}</button>
              </div>
              <div class="editor-filters-actions">
                <div id="filters-actions-slider-box"></div>
                <div>
                  <button class="editor-button" id="image-filters-reset" type="button" title="${messages.reset_editor}">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M86-560v-259h95v82q54-63 131.23-100 77.23-37 167.77-37 143 0 250.5 89.5T866-560H736q-26-82-95.5-135t-160.49-53Q419-748 366.5-723 314-698 277-655h69v95H86Zm137 332h514L570-460 450-300l-90-120-137 192ZM212-46q-53 0-89.5-36.5T86-172v-296h126v296h536v-296h126v296q0 53-36.5 89.5T748-46H212Z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <!-- Selected image panel -->

          <!-- Selected text panel -->
          <div class="v-stack" style="height: 100%; width: 100%; margin-top: 2rem;" id="selected-text-actions">
            <div class="v-stack" style="width: 100%; gap: 4px;">
              <h4>${messages.editor_actions_panel_title}</h4>

              <div class="h-stack" style="width: 100%; justify-content: space-between;">
                <p>${messages.editor_text_color}</p>
                <input type="color" name="text-color" id="text-color"/>
              </div>

              <div class="h-stack" style="width: 100%; justify-content: space-between;">
                <p>${messages.editor_text_style}</p>
                 <select class="editor-border-accent" name="text-style" id="text-style" style="width: 120px;">
                  <option value="normal">${messages.editor_text_style_normal}</option>
                  <option value="italic" style="font-style: italic;">${messages.editor_text_style_italic}</option>
                  <option value="bold" style="font-style: bold;">${messages.editor_text_style_bold}</option>
                </select>
              </div>

              <div class="h-stack" style="width: 100%; justify-content: space-between;">
                <p>${messages.editor_text_font}</p>
                 <select class="editor-border-accent" name="text-font" id="text-font" style="width: 160px;">
                  <option value="Arial" style="font-family: 'Arial', 'sans-serif';">Arial</option>
                  <option value="Verdana" style="font-family: 'Verdana', 'sans-serif';">Verdana</option>
                  <option value="Tahoma" style="font-family: 'Tahoma', 'sans-serif';">Tahoma</option>
                  <option value="Trebuchet MS" style="font-family: 'Trebuchet MS', 'sans-serif';">Trebuchet MS</option>
                  <option value="Times New Roman" style="font-family: 'Times New Roman', Times, 'sans-serif';">Times New Roman</option>
                  <option value="Georgia" style="font-family: 'Georgia', serif;">Georgia</option>
                  <option value="Garamond" style="font-family: 'Garamond', serif;">Garamond</option>
                  <option value="Courier New" style="font-family: 'Courier New', Courier, monospace;">Courier New</option>
                  <option value="Brush Script MT" style="font-family: 'Brush Script MT', cursive;">Brush Script MT</option>
                </select>
              </div>

              <div class="h-stack" style="width: 100%; justify-content: space-between;">
                <p>${messages.editor_text_size}</p>
                <input class="editor-border-accent" type="number" id="text-size" name="text-size" min="10" max="100" style="max-width: 150px; text-align: right;" />
              </div>
            </div>
          </div>
          <!-- Selected text panel -->
        </div>

         <!-- Canvas area -->
        <div id="konva-editor" class="editor-canvas"></div>
        <!-- Canvas area -->
      </div>

      <!-- Cropper toolbar -->
      <div class="editor-actions editor-flex-center js-crop-toolbar editor-hidden" style="gap: 1rem;">
        
        <!-- Zoom controller for cropper-->
        <div class="h-stack editor-flex-center editor-actions-zoom" style="gap: .5rem; padding: 0 4px;">
          <button class="js-crop-zoomout editor-button" type="button" title="${messages.editor_zoomout}">
            <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400ZM280-540v-80h200v80H280Z"/></svg>
          </button>

          <div class="editor-sizes">
            <label for="crop-stage-zoom" class="editor-size">
              <span class="editor-size-label">Zoom</span>
              <div class="h-stack" style="flex-direction: row-reverse;">
                <input class="editor-size-input editor-input-readonly" name="crop-stage-zoom" id="crop-stage-zoom" type="text" readonly style="text-align: center;"/>
                <span class="editor-input-adornment">%</span>
              </div>
            </label>
          </div>

          <button class="js-crop-zoomin editor-button" type="button" title="${messages.editor_zoomin}">
            <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Zm-40-60v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Z"/></svg>
          </button>
        </div>

        <button class="js-actions-crop-reset editor-button" type="button" title="${messages.reset_editor}">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M480-320v-100q0-25 17.5-42.5T540-480h100v60H540v100h-60Zm60 240q-25 0-42.5-17.5T480-140v-100h60v100h100v60H540Zm280-240v-100H720v-60h100q25 0 42.5 17.5T880-420v100h-60ZM720-80v-60h100v-100h60v100q0 25-17.5 42.5T820-80H720Zm111-480h-83q-26-88-99-144t-169-56q-117 0-198.5 81.5T200-480q0 72 32.5 132t87.5 98v-110h80v240H160v-80h94q-62-50-98-122.5T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q129 0 226.5 79.5T831-560Z"/></svg>
        </button>
        <div class="crop-ratio-selector js-ratio-actions">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M560-280h200v-200h-80v120H560v80ZM200-480h80v-120h120v-80H200v200Zm-40 320q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z"/></svg>
          <select name="ratio-selector" id="ratio-selector" class="editor-border-accent">
              <option value="0">${messages.editor_ratio_free}</option>
              <option value="1">${messages.editor_ratio_egal}</option>
              <option value="4-3">${messages.editor_ratio_standard}</option>
              <option value="3-4">${messages.editor_ratio_portrait}</option>
              <option value="19-9">${messages.editor_ratio_landscape}</option>
              <option value="1-1">${messages.editor_ratio_square}</option>
          </select>
        </div>
        <button class="js-actions-crop-cancel editor-button" type="button" title="${messages.crop_editor_cancel}">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
        </button>
        <button class="js-actions-crop-submit editor-button" type="button" title="${messages.crop_editor_submit}">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M400-304 240-464l56-56 104 104 264-264 56 56-320 320Z"/></svg>
        </button>
      </div>
      <!-- Cropper toolbar -->

      <!-- Canvas toolbar -->
      <div class="editor-actions js-toolbar" style="padding-top: 1.25rem;">

        <div class="h-stack editor-flex-center editor-actions-zoom" style="gap: .5rem; padding: 0 4px;">
          <button class="js-actions-zoomout editor-button" type="button" title="${messages.editor_zoomout}">
            <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400ZM280-540v-80h200v80H280Z"/></svg>
          </button>

          <div class="editor-sizes">
              <label for="resize-width" class="editor-size">
              <span class="editor-size-label">Zoom</span>
              <div class="h-stack" style="flex-direction: row-reverse;">
                <input class="editor-size-input editor-input-readonly" name="stage-zoom" id="stage-zoom" type="text" readonly style="text-align: center;"/>
                <span class="editor-input-adornment">%</span>
              </div>
            </label>
          </div>

          <button class="js-actions-zoomin editor-button" type="button" title="${messages.editor_zoomin}">
              <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Zm-40-60v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Z"/></svg>
            </button>
          </div>

          <div class="h-stack editor-actions-main" style="width: 100%; align-items: center; justify-content: flex-end;">
            <div class="h-stack editor-flex-center" style="width: 100%; gap: 1rem;">
              <button class="js-actions-reset editor-button" type="button" title="${messages.reset_editor}">
                <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm112-192L440-464v-216h80v184l128 128-56 56Z"/></svg>
              </button>

              <button id="js-actions-upload" class="editor-button" type="button" title="${messages.image_upload}">
                <input type="file" name="image-upload" id="image-upload" style="display: none" accept="image/*" multiple="false" />
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M480-480ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h320v80H200v560h560v-320h80v320q0 33-23.5 56.5T760-120H200Zm40-160h480L570-480 450-320l-90-120-120 160Zm440-320v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Z"/></svg>
              </button>

              <button class="js-actions-text editor-button" type="button" title="${messages.text_editor}">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M420-160v-520H200v-120h560v120H540v520H420Z"/></svg>
              </button>
            </div>

            <button class="js-actions-cancel editor-button editor-button-secondary" type="button">${messages.cancel}</button>
            <button class="js-actions-submit editor-button" type="button">${messages.upload}</button>
          </div>
        </div>
        <!-- Canvas toolbar -->
      </div>
    </aside>`;
