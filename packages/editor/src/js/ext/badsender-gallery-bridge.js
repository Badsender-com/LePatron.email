'use strict';

// Event names for the Knockout ↔ Vue communication channel (gallery panel)
const GALLERY_READY = 'GALLERY_READY';
const GALLERY_REFRESH = 'GALLERY_REFRESH';
const GALLERY_IMAGE_SELECTED = 'GALLERY_IMAGE_SELECTED';

class GalleryBridge extends EventTarget {
  ready() {
    this.dispatchEvent(new CustomEvent(GALLERY_READY));
  }

  // Request a gallery reload (e.g. after upload, delete, rename)
  refresh(galleryType) {
    this.dispatchEvent(new CustomEvent(GALLERY_REFRESH, { detail: { galleryType } }));
  }

  // Notify Mosaico that an image was selected from the Vue panel
  selectImage(file) {
    this.dispatchEvent(new CustomEvent(GALLERY_IMAGE_SELECTED, { detail: { file } }));
  }
}

const galleryBridge = new GalleryBridge();

module.exports = {
  galleryBridge,
  GALLERY_READY,
  GALLERY_REFRESH,
  GALLERY_IMAGE_SELECTED,
};
