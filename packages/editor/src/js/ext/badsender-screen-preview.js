'use strict';

var $ = require('jquery');
var ko = require('knockout');
var console = require('console');
const {
  ALWAYS_TRUE_MEDIA,
  VISIBLE_ON_BOTH_SUFFIX,
  previewMediaFor,
} = require('./preview-media.js');

let cssMediaResources = [];

function screenPreview(viewModel) {
  viewModel.isBothPreview = ko.observable(true);
  viewModel.isDesktopPreview = ko.observable(false);
  viewModel.isMobilePreview = ko.observable(false);

  function initializeMediaQueries() {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const stylesheet = document.styleSheets[i];

      if (stylesheet.title === 'template-stylesheet') {
        for (let j = 0; j < stylesheet.cssRules.length; j++) {
          const cssRule = stylesheet.cssRules[j];

          if (cssRule.type === 4) {
            cssMediaResources.push({
              stylesheet: stylesheet,
              cssMediaRuleIdx: j,
              baseMediaCondition: cssRule.conditionText,
            });
          }
        }
      }
    }

    setMediaQueries('both');
  }

  function getScreenVisibility() {
    const previewMode = viewModel.previewMode();
    viewModel.isBothPreview(previewMode === `both`);
    viewModel.isDesktopPreview(previewMode === `desktop`);
    viewModel.isMobilePreview(previewMode === `mobile`);
    setMediaQueries(previewMode);
  }

  viewModel.loadedTemplate.subscribe(
    initializeMediaQueries,
    viewModel,
    'change'
  );
  viewModel.previewMode.subscribe(getScreenVisibility, viewModel, 'change');
}

// See preview-media.js for what each mode does, shared with the head CSS.
function setMediaQueries(mode) {
  const { forceMedia, mediaSelectorSuffix } = previewMediaFor(mode);
  cssMediaResources.forEach(
    ({ stylesheet, cssMediaRuleIdx, baseMediaCondition }) => {
      const outputCondition = forceMedia
        ? ALWAYS_TRUE_MEDIA
        : baseMediaCondition;
      let styles = '';
      const cssRules = stylesheet.cssRules[cssMediaRuleIdx].cssRules;

      for (let i = 0; i < cssRules.length; i++) {
        cssRules[i].selectorText = mediaSelectorSuffix
          ? `${cssRules[i].selectorText}${mediaSelectorSuffix}`
          : cssRules[i].selectorText.replace(VISIBLE_ON_BOTH_SUFFIX, '');

        styles += `${cssRules[i].cssText}`;
      }

      stylesheet.deleteRule(cssMediaRuleIdx);
      stylesheet.insertRule(
        `@media ${outputCondition}{${styles}}`,
        cssMediaRuleIdx
      );
    }
  );
}

module.exports = screenPreview;
