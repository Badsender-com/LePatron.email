'use strict';

var $ = require('jquery');
var ko = require('knockout');
var console = require('console');

const desktopMediaQuery = 'only screen and (min-width: 0px)';
const visibleOnBoth = '.visible-on-both';
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

    setMediaQueries('both', true);
  }

  function getScreenVisibility() {
    const previewMode = viewModel.previewMode();
    viewModel.isBothPreview(previewMode === `both`);
    viewModel.isDesktopPreview(previewMode === `desktop`);
    viewModel.isMobilePreview(previewMode === `mobile`);
    setMediaQueries(previewMode, previewMode === `both`);
  }

  viewModel.loadedTemplate.subscribe(
    initializeMediaQueries,
    viewModel,
    'change'
  );
  viewModel.previewMode.subscribe(getScreenVisibility, viewModel, 'change');
}

function setMediaQueries(mode, setSuffix = false) {
  cssMediaResources.forEach(
    ({ stylesheet, cssMediaRuleIdx, baseMediaCondition }) => {
      const outputCondition = ['both', 'mobile'].includes(mode)
        ? desktopMediaQuery
        : baseMediaCondition;
      let styles = '';
      const cssRules = stylesheet.cssRules[cssMediaRuleIdx].cssRules;

      for (let i = 0; i < cssRules.length; i++) {
        cssRules[i].selectorText = setSuffix
          ? `${cssRules[i].selectorText}${visibleOnBoth}`
          : cssRules[i].selectorText.replace(visibleOnBoth, '');

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
