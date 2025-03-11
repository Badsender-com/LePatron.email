'use strict';
import Konva from 'Konva';
import { EditorCropper } from './image-editor-cropper';
import { EditorText } from './image-editor-text';
import { EditorFilters } from './image-editor-filters';

const $ = require('jquery');
const raf = window.requestAnimationFrame;
const ACTIVE_CLASS = `editor-active`;

const Editor = {
    // canva
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

    // actions
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
    crop: null,
    cropCancel: null,
    cropSubmit: null,
    lastCrop: null,
    cropToolbar: null,
    toolbar: null,
    fileAction: null,
    fileInput: null,
    imageActions: null,
    textActions: null,

    // misc
    deferredCallback: null,
    abort: null,
    data: null,
    file: null,
    messages: null,
    baseAnchors: [],
    cornerAnchors: [],
}

export function OpenEditor(next, abort, data, file, messages, parent, image) {
    Editor.deferredCallback = next;
    Editor.messages = messages;
    Editor.abort = abort;
    Editor.data = data;
    Editor.file = file;
    Editor.children = [];
    Editor.baseAnchors = ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'];
    Editor.cornerAnchors = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    initEditor(parent, image);

    // Advanced features have to be initialized after the stage is drawn at least one time
    Editor.cropper = EditorCropper(Editor);
    Editor.textHandler = EditorText(Editor);
    Editor.filtersHandler = EditorFilters(Editor, messages);

    bindHandlers();
    Editor.transformer.moveToTop();
}

function initEditor(parent, imageFile) {
    parent.after(modal(Editor.messages)); // Adds the editor as html content

    const container = document.getElementById('konva-editor');
    const stage = new Konva.Stage({
        container: container,
        width: container.clientWidth,
        height: container.clientHeight,
    });

    // The layer for the image
    const mainLayer = new Konva.Layer();

    // A transformer allows us to move and rotate objects within the canvas.
    // We want to keep the ratio and only do free resize with middle edge anchors.
    const transformer = new Konva.Transformer({ keepRatio: true });

    const uploadedImage = new Image();
    uploadedImage.src = imageFile.src;

    const mainImage = new Konva.Image({
        image: uploadedImage,
        draggable: true,
    });

    mainLayer.add(transformer);
    transformer.nodes([mainImage]);

    uploadedImage.onload = function() {
        mainImage.x(stage.width() / 2);
        mainImage.y(stage.height() / 2);
        mainImage.offsetX(mainImage.width() / 2);
        mainImage.offsetY(mainImage.height() / 2);
        mainLayer.add(mainImage);
        mainLayer.draw();
    }

    stage.add(mainLayer);

    const $wrapper = $('#editor-wrapper');

    // canva
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

    // actions
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
    Editor.crop = $wrapper.find('.js-actions-crop');
    Editor.cropCancel = $wrapper.find('.js-actions-crop-cancel');
    Editor.cropSubmit = $wrapper.find('.js-actions-crop-submit');
    Editor.cropToolbar = $wrapper.find('.js-crop-toolbar');
    Editor.ratioToolbar = $wrapper.find('.js-ratio-toolbar');
    Editor.toolbar = $wrapper.find('.js-toolbar');
    Editor.fileAction = $wrapper.find('#js-actions-upload');
    Editor.fileInput = $wrapper.find('#image-upload');
    Editor.imageActions = $wrapper.find('#selected-image-actions');
    Editor.textActions = $wrapper.find('#selected-text-actions');

    Editor.inputWidth.val(mainImage.width());
    Editor.inputHeight.val(mainImage.height());

    Editor.transformer.on('transform', function () {
        Editor.inputWidth.val(Math.round(Editor.transformer.width()));
        Editor.inputHeight.val(Math.round(Editor.transformer.height()));
    });

    Editor.selection = Editor.image;
    Editor.image.cache();

    Editor.wrapper.find('#selected-element-type').text(Editor.selection.getClassName());
    disableTextActions(true);

    raf(() => Editor.wrapper.addClass(ACTIVE_CLASS));
}

function bindHandlers() {
    Editor.cancel.on('click', () => clean(Editor.abort));
    Editor.submit.on('click', () => save());
    Editor.reset.on('click', () => reset());
    Editor.text.on('click', () => { Editor.textHandler.addText(); disableImageActions(true); disableTextActions(false); updateElementActions(false); updateTextActions(); });
    Editor.cornerRadius.on('input', () => handleCornerRadius());
    Editor.inputWidth.on('input', () => setSize(Editor.inputWidth.val(), Editor.inputHeight.val()));
    Editor.inputHeight.on('input', () => setSize(Editor.inputWidth.val(), Editor.inputHeight.val()));
    Editor.flipX.on('click', () => flipX());
    Editor.flipY.on('click', () => flipY());
    Editor.rotateRight.on('click', () => rotate(90));
    Editor.rotateLeft.on('click', () => rotate(-90));
    Editor.crop.on('click', () => startCropping());
    Editor.cropCancel.on('click', () => stopCropping(false));
    Editor.cropSubmit.on('click', () => stopCropping(true));
    Editor.stage.on("pointerdown", (e) => handleSelection(e));
    Editor.fileAction.on('click', () => Editor.fileInput.trigger('click'));
    Editor.fileInput.on('click', (e) => e.stopPropagation()); // To avoid recurse calls
    Editor.fileInput.on('change', (e) => handleFilePicked(e));
    
    window.addEventListener('keydown', (e) => handleDelete(e));
}

// Handlers
function setSize(width, height) {
  if (Editor.selection !== null) {
    Editor.selection.width(stringToNumber(width));
    Editor.selection.height(stringToNumber(height));
    Editor.selection.offsetX(width / 2);
    Editor.selection.offsetX(height / 2);
  } 
}

function flipX() {
    if (Editor.selection !== null) {
      Editor.selection.scaleX(Editor.selection.scaleX() * -1);
    }
}

function flipY() {
  if (Editor.selection !== null) {
    Editor.selection.scaleY(Editor.selection.scaleY() * -1);
  }
}

function rotate(degrees) {
  if (Editor.selection !== null) {
    Editor.selection.rotate(degrees);
  }
}

function startCropping() {
  if (Editor.selection === Editor.image) {
    Editor.cropping = true;
    Editor.cropper.start();
    Editor.toolbar.addClass('editor-hidden');
    Editor.cropToolbar.removeClass('editor-hidden');
  }
}

function stopCropping(doCrop) {
  Editor.cropping = false;
  Editor.cropper.stop(doCrop);
  Editor.toolbar.removeClass('editor-hidden');
  Editor.cropToolbar.addClass('editor-hidden');
}

function handleCornerRadius() {
  if (!Editor.selection instanceof Konva.Image || Editor.selection === null) return;

  Editor.selection.cornerRadius(stringToNumber(Editor.cornerRadius.val()));
  Editor.selection.cache();
}

function handleSelection(event) {
  if (Editor.cropping === true) return;
  if (event.target === Editor.selection) return;
  if (event.target.attrs.name?.includes("_anchor")) return; // Transformer anchors

  if (event.target !== Editor.stage) {
    Editor.selection = event.target;
    Editor.transformer.nodes([Editor.selection]);
    Editor.transformer.moveToTop(); // Prevents transformer from being hidden by other elements

    Editor.inputWidth.val(Math.round(Editor.transformer.width()));
    Editor.inputHeight.val(Math.round(Editor.transformer.height()));

    if (Editor.selection instanceof Konva.Text) {
      disableTextActions(false);
      disableImageActions(true);
      updateTextActions();
    } else if (Editor.selection instanceof Konva.Image) {
      disableImageActions(false);
      disableTextActions(true);
      Editor.cornerRadius.val(Editor.selection.cornerRadius());
    }
    else {
      Editor.cornerRadius.val(0);
      disableImageActions(true);
      disableTextActions(true);
    }

    Editor.transformer.moveToTop();
    updateElementActions(false);
    return;
  }

  Editor.transformer.nodes([]);
  Editor.selection = null;
  Editor.inputWidth.val(null);
  Editor.inputHeight.val(null);
  Editor.cornerRadius.val(0);
  disableImageActions(true);
  updateElementActions(true);
  disableTextActions(true);
}

function handleDelete(event) {
  if (Editor.selection === null || Editor.selection === Editor.image) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!Editor.selection.visible()) return; // Prevents deletion when editing a text or when cropping

  Editor.transformer.nodes([]);
  Editor.selection.destroy();
  Editor.children = Editor.children.filter(_node => _node !== Editor.selection);
  Editor.stage.batchDraw();
  Editor.selection = null;
}

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
      Editor.layer.add(image);
      Editor.transformer.nodes([image]);
      Editor.transformer.moveToTop();
      Editor.children.push(image);
      Editor.selection = image;
      Editor.inputWidth.val(Math.round(Editor.transformer.width()));
      Editor.inputHeight.val(Math.round(Editor.transformer.height()));
      Editor.cornerRadius.val(image.cornerRadius());
      disableImageActions(false);
      updateElementActions(false);
    };
  });
  fileReader.readAsDataURL(files[0]);
}

function reset() {
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
    Editor.lastCrop = null;
    Editor.ratio = "0";
    Editor.transformer.nodes([Editor.image]);
    Editor.selection = Editor.image;
    Editor.children.forEach(node => {
      node.destroy();
    });
    Editor.children = [];
    Editor.cornerRadius.val(0);
    disableImageActions(false);
    updateElementActions(false);

    Editor.image.cache();
}

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

// Utils
function stringToNumber(value) {
    if (value === undefined) return 1;

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 1 : parsed < 1 ? 1 : parsed;
}

function disableImageActions(disabled) {
  if (disabled === true) Editor.imageActions.addClass('editor-hidden');
  else Editor.imageActions.removeClass('editor-hidden');

  Editor.cornerRadius.prop('disabled', disabled);
  Editor.crop.prop('disabled', disabled);
}

function disableTextActions(disabled) {
  if (disabled === true) Editor.textActions.addClass('editor-hidden');
  else Editor.textActions.removeClass('editor-hidden');
}

function updateTextActions() {
  if (Editor.selection instanceof Konva.Text) {
    Editor.textColor.val(Editor.selection.fill());
    Editor.textStyle.val(Editor.selection.fontStyle());
  }
}

function updateElementActions(disabled) {
  Editor.inputWidth.prop('disabled', disabled);
  Editor.inputHeight.prop('disabled', disabled);
  Editor.flipX.prop('disabled', disabled);
  Editor.flipY.prop('disabled', disabled);
  Editor.rotateLeft.prop('disabled', disabled);
  Editor.rotateRight.prop('disabled', disabled);
  Editor.wrapper.find('#selected-element-type').text(disabled === true ? '-' : Editor.selection?.getClassName() ?? '-');
}

const modal = (messages) => 
    `<aside class="editor-frame" id="editor-wrapper">
      <div class="editor-layout">

        <div class="editor-header">
          <h4 class="text-white">${messages.editor_title}</h4>
          <div class="spacer"></div>
          <button class="js-actions-cancel editor-close-icon">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" stroke-width="50"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
          </button>
        </div>

        <div class="editor-layout-inner">

          <div class="v-stack" style="height: 100%; min-width: 220px; padding-top: .25rem; gap: 4px; overflow-y: auto;">
            <h4 style="text-decoration: underline;">${messages.editor_panel_title}</h4>

            <!-- Selected element panel -->
            <div class="v-stack" id="selected-element-actions">
              <div class="h-stack" style="gap: 4px; justify-content: space-between;">
                <p>Taille</p>
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
                <p>Mirroir</p>
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
                <p>Rotation</p>
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
            <div class="v-stack" style="height: 100%; justify-content: space-evenly;" id="selected-image-actions">
              <div class="v-stack" style="gap: 4px;">
                <h4 style="text-decoration: underline;">Actions</h4>

                <label for="corner-radius" class="editor-size" style="min-width: 150px;">
                  <span class="editor-size-label">${messages.input_corner_radius}</span>
                  <input type="range" name="corner-radius" id="corner-radius" min="0" max="100" value="0">
                </label>

                <button class="js-actions-crop editor-button" style="margin-bottom: 1rem;" type="button" title="${messages.crop_editor}">
                  <svg class="editor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M680-40v-160H280q-33 0-56.5-23.5T200-280v-400H40v-80h160v-160h80v640h640v80H760v160h-80Zm0-320v-320H360v-80h320q33 0 56.5 23.5T760-680v320h-80Z"/></svg>
                </button>
              </div>

              <div class="v-stack" style="gap: 4px;">
                <h4 style="text-decoration: underline;">Filtres</h4>
                <div class="editor-filters-list">
                  <button type="button" id="filters-grayscale">${messages.filters_grayscale}</button>
                  <button id="filters-blur">${messages.filters_blur}</button>
                  <button id="filters-pixelate">${messages.filters_pixelate}</button>
                  <button disabled="true">Contraste</button>
                  <button>Luminosité</button>
                  <button>Inverse</button>
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
            <div class="v-stack" style="height: 100%; width: 100%; justify-content: space-evenly;" id="selected-text-actions">
              <div class="v-stack" style="width: 100%; gap: 4px;">
                <h4 style="text-decoration: underline;">Actions</h4>

                <div class="h-stack" style="width: 100%; justify-content: space-between;">
                  <p>Couleur</p>
                  <input type="color" name="text-color" id="text-color">
                </div>

                <div class="h-stack" style="width: 100%; justify-content: space-between;">
                  <p>Style</p>
                   <select name="text-style" id="text-style" style="width: 120px;">
                    <option value="normal">Normal</option>
                    <option value="italic" style="font-style: italic;">Italic</option>
                    <option value="bold" style="font-style: bold;">Bold</option>
                  </select>
                </div>
              </div>
            </div>
            <!-- Selected text panel -->

          </div>

          <div id="konva-editor" class="editor-canvas"></div>
        </div>

        <div class="editor-actions editor-flex-center js-crop-toolbar editor-hidden">
          <div class="crop-ratio-selector js-ratio-actions">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M560-280h200v-200h-80v120H560v80ZM200-480h80v-120h120v-80H200v200Zm-40 320q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z"/></svg>
            <select name="ratio-selector" id="ratio-selector" style="border-radius: 2px;">
                <option value="0">Forme libre</option>
                <option value="4-3">Standard (4:3)</option>
                <option value="16-9">Paysage (téléphone) (16:9)</option>
                <option value="9-16">Portrait (téléphone) (9:16)</option>
                <option value="1-1">Carré (1:1)</option>
                <option value="3-2">Photo (3:2)</option>
                <option value="5-3">Cinéma large (5:3)</option>
                <option value="5-4">Quasi carré (5:4)</option>
                <option value="6-4">Photo (6:4)</option>
                <option value="7-5">Intermédiaire (7:5)</option>
                <option value="10-8">Appareil photo (10:8)</option>
            </select>
          </div>  
          <button class="js-actions-crop-cancel editor-button" type="button" title="${messages.crop_editor_cancel}">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
          </button>
          <button class="js-actions-crop-submit editor-button" type="button" title="${messages.crop_editor_submit}">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M400-304 240-464l56-56 104 104 264-264 56 56-320 320Z"/></svg>
          </button>
        </div>

        <div class="editor-actions js-toolbar">
          <div class="spacer"></div>

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

          <div class="spacer"></div>

          <button class="js-actions-cancel editor-button editor-button-secondary" type="button">${messages.cancel}</button>
          <button class="js-actions-submit editor-button" type="button">${messages.upload}</button>
        </div>
      </div>
    </aside>`;