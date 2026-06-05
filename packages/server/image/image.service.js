'use strict';

const { Galleries } = require('../common/models.common.js');

const normalizeExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext);

function filterGalleryFiles(files, { search, format, sortBy } = {}) {
  let result = [...files];

  if (search) {
    const needle = search.toLowerCase();
    result = result.filter((f) =>
      (f.label || f.name).toLowerCase().includes(needle)
    );
  }

  if (format) {
    const normalizedFormat = format.toLowerCase();
    result = result.filter((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      return normalizeExt(ext) === normalizedFormat;
    });
  }

  if (sortBy === 'date_desc') {
    result = result.sort((a, b) => {
      const dateA = a.uploadedAt ? new Date(a.uploadedAt) : new Date(0);
      const dateB = b.uploadedAt ? new Date(b.uploadedAt) : new Date(0);
      return dateB - dateA;
    });
  } else if (sortBy === 'date_asc') {
    result = result.sort((a, b) => {
      const dateA = a.uploadedAt ? new Date(a.uploadedAt) : new Date(0);
      const dateB = b.uploadedAt ? new Date(b.uploadedAt) : new Date(0);
      return dateA - dateB;
    });
  }

  return result;
}

function destroy(mongoId, imageName) {
  return Galleries.findOne({
    creationOrWireframeId: mongoId,
  }).then((gallery) => {
    // TODO: handle non existing gallery
    // mongoID could be incorrect

    const { files } = gallery;

    const imageIndex = files.findIndex((file) => file.name === imageName);

    const filesUpdated = files;

    filesUpdated.splice(imageIndex, 1);

    gallery.files = filesUpdated;

    gallery.markModified('files');
    return gallery.save();
  });
}

function renameLabel(mongoId, imageName, newLabel) {
  return Galleries.findOne({ creationOrWireframeId: mongoId }).then(
    (gallery) => {
      if (!gallery) throw new Error('Gallery not found');

      const files = gallery.files;
      const fileIndex = files.findIndex((f) => f.name === imageName);
      if (fileIndex === -1) throw new Error('Image not found');

      files[fileIndex].label = newLabel;
      gallery.files = files;
      gallery.markModified('files');
      return gallery.save();
    }
  );
}

module.exports = {
  destroy,
  filterGalleryFiles,
  renameLabel,
};
