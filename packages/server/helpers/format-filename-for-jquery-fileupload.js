'use strict'

const THUMBNAIL_SIZE = `111x111`

module.exports = fileName => {
  return {
    name: fileName,
    // full urls will be done in the editor
    url: fileName,
    deleteUrl: `/api/images/${fileName}`,
    // need to keep this for mosaico's galleries
    thumbnailUrl: `/api/images/cover/${THUMBNAIL_SIZE}/${fileName}`,
  }
}
