'use strict';
import { OpenEditor } from './image-editor';

const $ = require('jquery');

const raf = window.requestAnimationFrame;
const ACTIVE_CLASS = `bs-img-cropper--active`;

// https://github.com/gabn88/jQuery-File-Upload/commit/8041a660fe6703c048eb24282b18fa9cb7b17400
// https://github.com/blueimp/jQuery-File-Upload/wiki/Process-queue-API-examples
// https://github.com/tkvw/jQuery-File-Upload/blob/dca36beedae87c0cc50c456c0dd0e2b57ab6404e/js/jquery.fileupload-image-editor.js

$.widget(`blueimp.fileupload`, $.blueimp.fileupload, {
  processActions: {
    cropImage(data) {
      const dfd = $.Deferred();

      const next = () => dfd.resolveWith(this, [data]);
      const abort = () => dfd.rejectWith(this, [data]);

      const {files, index, messages } = data;
      const originalFile = files[index];
      const { name, type } = originalFile;
      //TODO improve this to be independ of the element name
      // As this element exists in the Dom only when gallery is open,
      // the button editImage, is in charge of opening the gallery panel too
      const dropZone = document.getElementById("toolimagesgallery")

      if (/gif|svg/.test(type)) return next();

      // convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(originalFile);
      reader.addEventListener(`load`, onFileLoad);
      reader.addEventListener(`error`, () => {
        clean();
        console.error(`can't read the file`);
      });
      // image is loaded
      // Let's start!
      function onFileLoad() {
        const fileResult = reader.result;
        const image = new Image();
        image.src = fileResult;
        image.onload = () => {
          try {
            OpenEditor(next, abort, data, { index: index, name: name, type: type }, messages, dropZone, image);
          } catch (error) {
            console.log({error});
          }
        };
      }

      // we just need to replace the original File
      // • https://stackoverflow.com/a/43185450/2193440
      // • https://developer.mozilla.org/en-US/docs/Web/API/File/File#Syntax
      // function crop() {
      //   imgCropper.getCroppedCanvas().toBlob((resultBlob) => {
      //     const croppedImage = new File([resultBlob], name, { type });
      //     data.files[index] = croppedImage;
      //     clean();
      //   });
      // }

      function clean(deferredCallback = next) {
        $(document).off(`keyup.bs-cropper`);
        const $wrapper = $(`.js-wrapper`);
        if (!$wrapper.length) {
          console.warn(`image cropper not existing before cleaning`);
          return deferredCallback();
        }
        $wrapper.css(`pointer-events`, `none`);
        raf(() => $wrapper.removeClass(ACTIVE_CLASS));
        $wrapper.on(`transitionend`, () => {
          $wrapper.remove();
          deferredCallback();
        });
      }
      return dfd.promise();
    },
  },
});
