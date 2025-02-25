'use strict';
import Konva from 'Konva';

const $ = require('jquery');
const raf = window.requestAnimationFrame;
const ACTIVE_CLASS = `bs-img-cropper--active`;

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
    },
    image: null,

    // actions
    wrapper: null,
    cancel: null,
    submit: null,
    reset: null,
    inputWidth: null,
    inputHeight: null,
    flipX: null,
    flipY: null,
    rotateRight: null,
    rotateLeft: null,

    // misc
    deferredCallback: null,
    abort: null,
}

export function OpenEditor(next, abort, messages, parent, image) {
    initEditor(messages, parent, image);
    bindHandlers();
    Editor.deferredCallback = next;
    Editor.abort = abort;

}

function initEditor(messages, parent, imageFile) {
    parent.after(modal(messages));

    const container = document.getElementById('konva-editor');
    const stage = new Konva.Stage({
        container: container,
        width: container.clientWidth,
        height: container.clientHeight,
    });

    // The layer for the image
    const mainLayer = new Konva.Layer();

    // A transformer allows us to move and rotate objects within the canvas.
    const transformer = new Konva.Transformer();

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

    const $wrapper = $(`.js-editor-wrapper`);

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
    };
    Editor.image = mainImage;

    // actions
    Editor.wrapper = $wrapper;
    Editor.cancel = $wrapper.find(`.js-actions-cancel`);
    Editor.submit = $wrapper.find(`.js-actions-submit`);
    Editor.reset = $wrapper.find(`.js-actions-reset`);
    Editor.inputWidth = $wrapper.find(`#cropper-width`);
    Editor.inputHeight = $wrapper.find(`#cropper-height`);
    Editor.flipX = $wrapper.find(`.js-actions-mirror-vertical`);
    Editor.flipY = $wrapper.find(`.js-actions-mirror-horizontal`);
    Editor.rotateRight = $wrapper.find(`.js-actions-rotate-right`);
    Editor.rotateLeft = $wrapper.find(`.js-actions-rotate-left`);

    Editor.inputWidth.val(mainImage.width());
    Editor.inputHeight.val(mainImage.height());

    Editor.transformer.on('transformend', function () {
        Editor.inputWidth.val(Math.round(Editor.transformer.width()));
        Editor.inputHeight.val(Math.round(Editor.transformer.height()));
    });

    raf(() => Editor.wrapper.addClass(ACTIVE_CLASS));
}

function bindHandlers() {
    Editor.cancel.on('click', () => clean(Editor.abort));
    Editor.reset.on('click', () => reset());
    Editor.inputWidth.on('input', () => setSize(Editor.image, Editor.inputWidth.val(), Editor.inputHeight.val()));
    Editor.inputHeight.on('input', () => setSize(Editor.image, Editor.inputWidth.val(), Editor.inputHeight.val()));
    Editor.flipX.on('click', () => flipX(Editor.image));
    Editor.flipY.on('click', () => flipY(Editor.image));
    Editor.rotateRight.on('click', () => rotate(Editor.image, 90));
    Editor.rotateLeft.on('click', () => rotate(Editor.image, -90));
}

// Handlers
function setSize(image, width, height) {
    image.width(stringToNumber(width));
    image.height(stringToNumber(height));
    image.offsetX(width / 2);
    image.offsetX(height / 2);
}

function flipX(element) {
    element.scaleX(element.scaleX() * -1);
}

function flipY(element) {
    element.scaleY(element.scaleY() * -1);
}

function rotate(element, degrees) {
    element.rotate(degrees);
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
    Editor.image.offsetX(Editor.baseImage.width/ 2);
    Editor.image.offsetY(Editor.baseImage.height / 2);
    // TODO: Remove children for future features ...
}

function clean(deferredCallback = Editor.deferredCallback) {
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

const modal = (messages) => 
    `<aside class="bs-img-cropper js-editor-wrapper">
      <div class="bs-img-cropper__in">
        <span class="js-actions-cancel fa fa-fw fa-times"></span>
        <div id="konva-editor" class="bs-img-cropper__croppie"></div>
        <div class="bs-img-cropper__actions">
          <button class="js-actions-reset bs-img-cropper__button" style="margin-right: 1rem!important;" type="button" title="${messages.reset_editor}">
            <svg class="bs-img-cropper__fa-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm112-192L440-464v-216h80v184l128 128-56 56Z"/></svg>
          </button>
          <div style="flex-grow: 1;"></div>
          <div class="bs-img-cropper__sizes">
            <label for="cropper-width" class="bs-img-cropper__size">
              <span class="bs-img-cropper__size-label">width</span>
              <input class="bs-img-cropper__size-input" id="cropper-width" name="cropper-width" type="number" min="0" />
            </label>
            <label for="cropper-height" class="bs-img-cropper__size">
              <span class="bs-img-cropper__size-label">height</span>
              <input class="bs-img-cropper__size-input" id="cropper-height" name="cropper-height" type="number" min="0" />
            </label>
          </div>
          <button class="js-actions-crop bs-img-cropper__button" type="button" title="${messages.crop_editor}">
            <svg class="bs-img-cropper__fa-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M680-40v-160H280q-33 0-56.5-23.5T200-280v-400H40v-80h160v-160h80v640h640v80H760v160h-80Zm0-320v-320H360v-80h320q33 0 56.5 23.5T760-680v320h-80Z"/></svg>
          </button>
          <button class="js-actions-mirror-vertical bs-img-cropper__button bs-img-cropper__button--group" type="button" title="${messages.vertical_mirror}">
            <svg class="bs-img-cropper__fa-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path fill="currentColor" d="M214.059 377.941H168V134.059h46.059c21.382 0 32.09-25.851 16.971-40.971L144.971 7.029c-9.373-9.373-24.568-9.373-33.941 0L24.971 93.088c-15.119 15.119-4.411 40.971 16.971 40.971H88v243.882H41.941c-21.382 0-32.09 25.851-16.971 40.971l86.059 86.059c9.373 9.373 24.568 9.373 33.941 0l86.059-86.059c15.12-15.119 4.412-40.971-16.97-40.971z"></path></svg>
          </button>
          <button class="js-actions-mirror-horizontal bs-img-cropper__button" type="button" title="${messages.horizontal_mirror}">
            <svg class="bs-img-cropper__fa-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M377.941 169.941V216H134.059v-46.059c0-21.382-25.851-32.09-40.971-16.971L7.029 239.029c-9.373 9.373-9.373 24.568 0 33.941l86.059 86.059c15.119 15.119 40.971 4.411 40.971-16.971V296h243.882v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.568 0-33.941l-86.059-86.059c-15.119-15.12-40.971-4.412-40.971 16.97z"></path></svg>
          </button>
          <button class="js-actions-rotate-left bs-img-cropper__button bs-img-cropper__button--group" type="button" title="${messages.rotate_left}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/></svg>
          </button>
          <button class="js-actions-rotate-right bs-img-cropper__button" type="button" title="${messages.rotate_right}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/></svg>
          </button>
          <button class="js-actions-cancel bs-img-cropper__button bs-img-cropper__button--secondary" type="button">${messages.cancel}</button>
          <button class="js-actions-submit bs-img-cropper__button" type="button">${messages.upload}</button>
        </div>
      </div>
    </aside>`;