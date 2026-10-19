'use strict';

// How the gallery extensions change a gallery's Knockout list: one entry at a
// time, found by its stored name. Never the whole array swapped for a new
// one: that changes the identity of every file, which cancelled any rename in
// flight and closed every open inline editor in the grid. And never by a
// remembered index: an upload unshifts, a delete splices, and either can land
// while a request is in flight.

function indexByName(gallery, name) {
  return gallery().findIndex((file) => file.name === name);
}

/**
 * Put `entry` where the file called `name` sits.
 *
 * @returns {boolean} false when the list no longer holds that file
 */
function replaceByName(gallery, name, entry) {
  const index = indexByName(gallery, name);
  if (index === -1) return false;
  gallery.splice(index, 1, entry);
  return true;
}

/**
 * Take the file called `name` out of the list, and give the gallery status
 * the new count, which is what the panel shows once the gallery is loaded.
 */
function removeByName(gallery, name, status) {
  const index = indexByName(gallery, name);
  if (index === -1) return;
  gallery.splice(index, 1);
  if (status) status(gallery().length);
}

module.exports = { indexByName, replaceByName, removeByName };
