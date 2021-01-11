'use strict'

const $ = require('jquery')
const Cropper = require('cropperjs')

const raf = window.requestAnimationFrame
const ACTIVE_CLASS = `bs-img-cropper--active`

// https://github.com/gabn88/jQuery-File-Upload/commit/8041a660fe6703c048eb24282b18fa9cb7b17400
// https://github.com/blueimp/jQuery-File-Upload/wiki/Process-queue-API-examples
// https://github.com/tkvw/jQuery-File-Upload/blob/dca36beedae87c0cc50c456c0dd0e2b57ab6404e/js/jquery.fileupload-image-editor.js

$.widget(`blueimp.fileupload`, $.blueimp.fileupload, {
  processActions: {
    cropImage(data) {
      const dfd = $.Deferred()
      const next = () => dfd.resolveWith(this, [data])
      const abort = () => dfd.rejectWith(this, [data])

      const { dropZone, files, index, messages } = data
      const originalFile = files[index]
      const { name, type } = originalFile

      if (/gif|svg/.test(type)) return next()

      let imgCropper = false

      // convert file to base64
      // • this will be consumed by croppie
      const reader = new FileReader()
      reader.readAsDataURL(originalFile)
      reader.addEventListener(`load`, onFileLoad)
      reader.addEventListener(`error`, () => {
        clean()
        console.error(`can't read the file`)
      })
      // image is loaded, so is Croppie.
      // Let's start!
      function onFileLoad() {
        const fileResult = reader.result
        const image = new Image()
        image.src = fileResult
        image.onload = () => onImageSize(image)
      }

      // initialize cropping
      function onImageSize(image) {
        $(`.js-crop-wrapper`).remove()
        const {
          $wrapper,
          cropZone,
          $cancel,
          $rotateLeft,
          $rotateRight,
          $mirrorVertical,
          $mirrorHorizontal,
          $submit,
          $width,
          $height,
        } = createResizePopup(dropZone, messages)

        // cropper needs an image to begin with
        $(image).appendTo(cropZone)
        // viewMode: 1 restrict dragging
        // • https://github.com/fengyuanchen/cropperjs#viewmode
        imgCropper = new Cropper(image, { viewMode: 1 })

        // bind events
        $(document).on(`keyup.bs-cropper`, domEvent => {
          if (domEvent.keyCode === 27) clean(abort)
        })
        image.addEventListener(`crop`, cropperEvent => {
          updateSizeFields({ imgCropper, $width, $height })
        })
        $cancel.on(`click`, domEvent => clean(abort))
        $rotateLeft.on(`click`, domEvent => imgCropper.rotate(-90))
        $rotateRight.on(`click`, domEvent => imgCropper.rotate(90))
        let scaleX = 1
        let scaleY = 1
        $mirrorHorizontal.on(`click`, domEvent => {
          scaleX = scaleX * -1
          imgCropper.scaleX(scaleX)
        })
        $mirrorVertical.on(`click`, domEvent => {
          scaleY = scaleY * -1
          imgCropper.scaleY(scaleY)
        })
        const setSizeFromInput = () => setSize({ imgCropper, $width, $height })
        $width.on(`input`, setSizeFromInput)
        $height.on(`input`, setSizeFromInput)
        $submit.on(`click`, domEvent => crop())
        raf(() => {
          $wrapper.addClass(ACTIVE_CLASS)
          updateSizeFields({ imgCropper, $width, $height })
        })
      }

      // we just need to replace the original File
      // • https://stackoverflow.com/a/43185450/2193440
      // • https://developer.mozilla.org/en-US/docs/Web/API/File/File#Syntax
      function crop() {
        imgCropper.getCroppedCanvas().toBlob(resultBlob => {
          const croppedImage = new File([resultBlob], name, { type })
          data.files[index] = croppedImage
          clean()
        })
      }

      function clean(deferredCallback = next) {
        imgCropper && imgCropper.destroy && imgCropper.destroy()
        $(document).off(`keyup.bs-cropper`)
        const $wrapper = $(`.js-crop-wrapper`)
        if (!$wrapper.length) {
          console.warn(`image cropper not existing before cleaning`)
          return deferredCallback()
        }
        $wrapper.css(`pointer-events`, `none`)
        raf(() => $wrapper.removeClass(ACTIVE_CLASS))
        $wrapper.on(`transitionend`, event => {
          $wrapper.remove()
          deferredCallback()
        })
      }
      return dfd.promise()
    },
  },
})

function createResizePopup(dropZone, messages) {
  const markup = `<aside class="bs-img-cropper js-crop-wrapper">
  <div class="bs-img-cropper__in js-crop-content">
    <span class="js-crop-cancel fa fa-fw fa-times"></span>
    <div class="bs-img-cropper__croppie js-crop"></div>
    <div class="bs-img-cropper__actions">
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
      <button class="js-crop-mirror-vertical bs-img-cropper__button bs-img-cropper__button--group" type="button" title="${messages.vertical_mirror}">
        <svg class="bs-img-cropper__fa-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path fill="currentColor" d="M214.059 377.941H168V134.059h46.059c21.382 0 32.09-25.851 16.971-40.971L144.971 7.029c-9.373-9.373-24.568-9.373-33.941 0L24.971 93.088c-15.119 15.119-4.411 40.971 16.971 40.971H88v243.882H41.941c-21.382 0-32.09 25.851-16.971 40.971l86.059 86.059c9.373 9.373 24.568 9.373 33.941 0l86.059-86.059c15.12-15.119 4.412-40.971-16.97-40.971z"></path></svg>
      </button>
      <button class="js-crop-mirror-horizontal bs-img-cropper__button" type="button" title="${messages.horizontal_mirror}">
        <svg class="bs-img-cropper__fa-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M377.941 169.941V216H134.059v-46.059c0-21.382-25.851-32.09-40.971-16.971L7.029 239.029c-9.373 9.373-9.373 24.568 0 33.941l86.059 86.059c15.119 15.119 40.971 4.411 40.971-16.971V296h243.882v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.568 0-33.941l-86.059-86.059c-15.119-15.12-40.971-4.412-40.971 16.97z"></path></svg>
      </button>
      <button class="js-crop-rotate-left bs-img-cropper__button bs-img-cropper__button--group" type="button" title="${messages.rotate_left}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/></svg>
      </button>
      <button class="js-crop-rotate-right bs-img-cropper__button" type="button" title="${messages.rotate_right}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/></svg>
      </button>
      <button class="js-crop-cancel bs-img-cropper__button bs-img-cropper__button--secondary" type="button">${messages.cancel}</button>
      <button class="js-crop-submit bs-img-cropper__button" type="button">${messages.upload}</button>
    </div>
  </div>
</aside>`

  dropZone.after(markup)

  const $wrapper = $(`.js-crop-wrapper`)
  const $cropZone = $wrapper.find(`.js-crop`)
  const cropZone = $cropZone[0]
  const $cancel = $wrapper.find(`.js-crop-cancel`)
  const $mirrorVertical = $wrapper.find(`.js-crop-mirror-vertical`)
  const $mirrorHorizontal = $wrapper.find(`.js-crop-mirror-horizontal`)
  const $rotateLeft = $wrapper.find(`.js-crop-rotate-left`)
  const $rotateRight = $wrapper.find(`.js-crop-rotate-right`)
  const $submit = $wrapper.find(`.js-crop-submit`)
  const $width = $wrapper.find(`#cropper-width`)
  const $height = $wrapper.find(`#cropper-height`)
  return {
    $wrapper,
    cropZone,
    $cancel,
    $rotateLeft,
    $rotateRight,
    $mirrorVertical,
    $mirrorHorizontal,
    $submit,
    $width,
    $height,
  }
}

function stringToNumber(value) {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? 1 : parsed < 1 ? 1 : parsed
}

function updateSizeFields({ imgCropper, $width, $height }) {
  const cropperData = imgCropper.getData(true)
  $width.val(cropperData.width)
  $height.val(cropperData.height)
}

function setSize({ imgCropper, $width, $height }) {
  const [width, height] = [$width, $height].map($el => {
    return stringToNumber($el.val())
  })
  const cropperData = imgCropper.getData(true)
  imgCropper.setData(Object.assign({}, cropperData, { width, height }))
}
