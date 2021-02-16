'use strict';

const getSlug = require('speakingurl');

// take care of slugging everything BUT the file extension
// keeping this file as minimal as possible -> used in front-end (editor)
const extReg = /\.[0-9a-z]+$/;

function slugFilename(name) {
  let fileName = name.toLowerCase().trim();
  // It seems that some files came here without extension O_O'
  // https://github.com/Frolipon/mosaico/issues/71
  // Haven't been able to reproduce but secure it
  const hasExtension = extReg.test(fileName);
  if (!hasExtension) {
    console.log('[SLUG FILENAME] impossible to slug', name);
    return false;
  }
  const ext = extReg.exec(fileName)[0];
  fileName = fileName.replace(ext, '');
  fileName = getSlug(fileName.trim()) + ext;
  return fileName;
}

module.exports = slugFilename;
