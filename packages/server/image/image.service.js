const { Galleries } = require('../common/models.common.js');

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

module.exports = {
  destroy,
};
