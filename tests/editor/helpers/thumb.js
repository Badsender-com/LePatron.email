'use strict';

// One gallery thumbnail, the real component mounted on its own, its props
// driven directly: what the panel would hand it.

const Vue = require('vue/dist/vue.common');
const Thumb = require('../../../packages/editor/src/js/vue/components/gallery/thumb.js');

const STRINGS = {
  remove: 'Supprimer __label__',
  editAction: 'Modifier __label__',
  renameAction: 'Renommer __label__',
  renameInput: 'rename-input',
};

const ALL = { rename: true, edit: true, remove: true };
const NONE = { rename: false, edit: false, remove: false };

const FILE = {
  name: '6a2135b7f802c2a6f99a4242-abc.png',
  label: 'mon image.png',
  thumbnailUrl: '/api/images/cover/111x111/6a2135b7f802c2a6f99a4242-abc.png',
};

/**
 * @param {Object} [file]
 * @param {Object} [actions] what the user may do, every action by default
 * @returns {Vue} the mounted thumbnail, detached
 */
function mountThumb(file = FILE, actions = ALL) {
  const Component = Vue.extend(Thumb);
  return new Component({
    propsData: { file, strings: STRINGS, actions },
  }).$mount();
}

module.exports = { STRINGS, ALL, NONE, FILE, mountThumb };
