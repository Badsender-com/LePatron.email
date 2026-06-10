'use strict';

const createError = require('http-errors');

const {
  Galleries,
  Mailings,
  Templates,
} = require('../common/models.common.js');
const modelsUtils = require('../utils/model.js');
const ERROR_CODES = require('../constant/error-codes.js');

const normalizeExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext);

// fallback to the epoch so files without an uploadedAt sort as the oldest
const fileDate = (file) =>
  file.uploadedAt ? new Date(file.uploadedAt) : new Date(0);

function filterGalleryFiles(files, { search, format, sortBy } = {}) {
  let result = [...files];

  // query params can arrive as arrays/objects (e.g. ?search[]=a) — only string
  // values are meaningful for these text comparisons, anything else is ignored
  if (typeof search === 'string' && search) {
    const needle = search.toLowerCase();
    result = result.filter((f) =>
      (f.label || f.name).toLowerCase().includes(needle)
    );
  }

  if (typeof format === 'string' && format) {
    const normalizedFormat = format.toLowerCase();
    result = result.filter((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      return normalizeExt(ext) === normalizedFormat;
    });
  }

  if (sortBy === 'date_desc') {
    result.sort((a, b) => fileDate(b) - fileDate(a));
  } else if (sortBy === 'date_asc') {
    result.sort((a, b) => fileDate(a) - fileDate(b));
  }

  return result;
}

// a gallery is owned by its parent mailing or template (creationOrWireframeId);
// galleries themselves carry no _company, so authorization is delegated to the
// parent. Throws Forbidden if the parent doesn't belong to the user's group.
async function assertGalleryOwnership(user, creationOrWireframeId) {
  const query = modelsUtils.addGroupFilter(user, {
    _id: creationOrWireframeId,
  });
  const [mailing, template] = await Promise.all([
    Mailings.findOne(query, '_id'),
    Templates.findOne(query, '_id'),
  ]);
  if (!mailing && !template) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_GALLERY_ACCESS);
  }
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
      if (!gallery) {
        throw new createError.NotFound(ERROR_CODES.GALLERY_NOT_FOUND);
      }

      const files = gallery.files;
      const fileIndex = files.findIndex((f) => f.name === imageName);
      if (fileIndex === -1) {
        throw new createError.NotFound(ERROR_CODES.GALLERY_IMAGE_NOT_FOUND);
      }

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
  assertGalleryOwnership,
};
