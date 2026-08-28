/**
 * @jest-environment jsdom
 */
'use strict';

const {
  galleryBridge,
  GALLERY_READY,
  GALLERY_REFRESH,
  GALLERY_IMAGE_SELECTED,
} = require('../../packages/editor/src/js/ext/badsender-gallery-bridge');

describe('galleryBridge', () => {
  it('dispatches GALLERY_READY with no payload', (done) => {
    galleryBridge.addEventListener(GALLERY_READY, () => done(), { once: true });
    galleryBridge.ready();
  });

  it('dispatches GALLERY_REFRESH with the gallery type', (done) => {
    galleryBridge.addEventListener(
      GALLERY_REFRESH,
      (e) => {
        expect(e.detail.galleryType).toBe('mailing');
        done();
      },
      { once: true }
    );
    galleryBridge.refresh('mailing');
  });

  it('dispatches GALLERY_IMAGE_SELECTED with the file', (done) => {
    const file = { name: 'test.jpg', url: '/images/test.jpg' };
    galleryBridge.addEventListener(
      GALLERY_IMAGE_SELECTED,
      (e) => {
        expect(e.detail.file).toEqual(file);
        done();
      },
      { once: true }
    );
    galleryBridge.selectImage(file);
  });

  it('exports event names as constants', () => {
    expect(GALLERY_READY).toBe('GALLERY_READY');
    expect(GALLERY_REFRESH).toBe('GALLERY_REFRESH');
    expect(GALLERY_IMAGE_SELECTED).toBe('GALLERY_IMAGE_SELECTED');
  });
});
