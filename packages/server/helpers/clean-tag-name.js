'use strict';

// ensure tags formating
// they will be use inside the DOM as data-tags attributes
// Array will be retrieved by splitting comas
// prevent everything that can break this behavior
function cleanTagName(tag) {
  return tag.replace(/[",]/g, ' ').trim();
}

module.exports = cleanTagName;
