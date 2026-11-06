'use strict';

/**
 * The left bar of the editor (boards « Éditeur v2 », decision of 2026-11-06):
 * three tabs, two sub-tabs each.
 *
 * - « Blocs »: the template's blocks and the saved ones, with a search;
 * - « Images »: the email's gallery and the template's (the gallery left the
 *   top bar);
 * - « Réglages »: the content and the style options.
 *
 * No new state: the tab is read from what the editor already keeps, so the
 * code that moves between them keeps working. `selectedTool` is Mosaico's
 * (0 blocks, 1 content, 2 style: selecting a block goes from 0 to 1), and
 * `showGallery` opens the gallery over the bar, as an image's « Choisir »
 * does.
 */

const ko = require('knockout');

const BLOCKS = 0;
const CONTENT = 1;
const STYLE = 2;

function leftBar(viewModel) {
  viewModel.leftBarTab = ko.pureComputed(function () {
    if (viewModel.showGallery()) return 'images';
    return viewModel.selectedTool() === BLOCKS ? 'blocks' : 'settings';
  });

  // « Réglages » reopens on the sub-tab it was left on.
  let settingsTool = CONTENT;
  viewModel.selectedTool.subscribe(function (tool) {
    if (tool !== BLOCKS) settingsTool = tool;
  });

  viewModel.showLeftBarTab = function (tab) {
    if (tab === 'images') {
      viewModel.showGallery(true);
      return;
    }
    viewModel.showGallery(false);
    if (tab === 'blocks') viewModel.selectedTool(BLOCKS);
    else if (viewModel.selectedTool() === BLOCKS)
      viewModel.selectedTool(settingsTool);
  };

  // The two sub-tabs of the open tab, each with its state and its setter.
  function subTab(label, active, select) {
    return { label: label, active: active, select: select };
  }

  viewModel.leftBarSubTabs = ko.pureComputed(function () {
    const tab = viewModel.leftBarTab();
    if (tab === 'blocks') {
      const blocks = viewModel.blocksActiveTab();
      return [
        ['left-bar-template-blocks', 'TEMPLATE_BLOCKS'],
        ['left-bar-saved-blocks', 'CUSTOM_BLOCKS'],
      ].map(function (pair) {
        return subTab(pair[0], blocks === pair[1], function () {
          viewModel.blocksActiveTab(pair[1]);
        });
      });
    }
    if (tab === 'images') {
      const gallery = viewModel.selectedImageTab();
      return ['gallery-mailing', 'gallery-template'].map(function (label, i) {
        return subTab(label, gallery === i, function () {
          viewModel.selectedImageTab(i);
        });
      });
    }
    const tool = viewModel.selectedTool();
    return [
      ['left-bar-content', CONTENT],
      ['left-bar-styles', STYLE],
    ].map(function (pair) {
      return subTab(pair[0], tool === pair[1], function () {
        viewModel.selectedTool(pair[1]);
      });
    });
  });

  // The search of « Blocs du template », on the names the cards show.
  viewModel.blockSearch = ko.observable('');

  viewModel.blockDisplayName = function (blockDef) {
    if (viewModel.isSyntheticBlock && viewModel.isSyntheticBlock(blockDef)) {
      return viewModel.t(viewModel.syntheticBlockLabelKey(blockDef));
    }
    return viewModel.t('__name__', {
      name: ko.utils.unwrapObservable(blockDef.type),
    });
  };

  viewModel.matchesBlockSearch = function (blockDef) {
    const query = viewModel.blockSearch().trim().toLocaleLowerCase();
    if (!query) return true;
    return String(viewModel.blockDisplayName(blockDef))
      .toLocaleLowerCase()
      .includes(query);
  };

  viewModel.noBlockMatches = ko.pureComputed(function () {
    if (!viewModel.blockSearch().trim()) return false;
    return !ko.utils
      .unwrapObservable(viewModel.blockDefs)
      .some(viewModel.matchesBlockSearch);
  });
}

module.exports = leftBar;
