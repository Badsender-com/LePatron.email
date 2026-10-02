'use strict';

// How the canvas previews media queries in each preview mode. Shared by the
// template's own stylesheet (badsender-screen-preview.js) and the head CSS
// (head-css/canvas-preview.js), so both follow the same rules.
//
// The canvas is a div of the editor's document, so a media query is evaluated
// against the browser window, never against the canvas width: shrinking the
// canvas to 350px triggers no mobile rule on its own. The condition is
// replaced by one that always holds instead:
//
//   - `mobile`: forced, so the mobile rules show;
//   - `both`, the default: forced too, but every selector inside gets the
//     `.visible-on-both` suffix. Nothing in the editor carries that class, so
//     in practice the mobile rules do NOT show in this mode;
//   - any other mode (`desktop`, `large`): the author's condition, as written.
//
// EVERY media query is forced, not only the `max-width` ones: a desktop-only
// `min-width` query applies too. Blunt, but it is how the template behaves.

const ALWAYS_TRUE_MEDIA = 'only screen and (min-width: 0px)';
const VISIBLE_ON_BOTH_SUFFIX = '.visible-on-both';

/**
 * @param {string} [mode] the editor's `previewMode`
 * @returns {{ forceMedia: boolean, mediaSelectorSuffix: string }}
 */
function previewMediaFor(mode) {
  return {
    forceMedia: mode === 'mobile' || mode === 'both',
    mediaSelectorSuffix: mode === 'both' ? VISIBLE_ON_BOTH_SUFFIX : '',
  };
}

module.exports = {
  ALWAYS_TRUE_MEDIA,
  VISIBLE_ON_BOTH_SUFFIX,
  previewMediaFor,
};
