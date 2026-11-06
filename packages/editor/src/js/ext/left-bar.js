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

  // The tabs and their sub-tabs, built once: Knockout keeps their buttons,
  // and the focus with them, as they change state.
  function subTab(label, observable, value) {
    return {
      label: label,
      active: ko.pureComputed(function () {
        return observable() === value;
      }),
      select: function () {
        observable(value);
      },
    };
  }

  function tab(id, label, controls, subTabs) {
    // « Réglages » shows the content or the styles.
    if (id === 'settings') {
      controls = ko.pureComputed(function () {
        return viewModel.selectedTool() === STYLE ? 'toolstyles' : 'toolcontents';
      });
    }
    return {
      tab: id,
      label: label,
      controls: controls,
      active: ko.pureComputed(function () {
        return viewModel.leftBarTab() === id;
      }),
      subTabs: subTabs,
    };
  }

  viewModel.leftBarTabs = [
    tab('blocks', 'left-bar-blocks', 'toolblocks', [
      subTab(
        'left-bar-template-blocks',
        viewModel.blocksActiveTab,
        'TEMPLATE_BLOCKS'
      ),
      subTab('left-bar-saved-blocks', viewModel.blocksActiveTab, 'CUSTOM_BLOCKS'),
    ]),
    tab('images', 'left-bar-images', 'toolimages', [
      subTab('gallery-mailing', viewModel.selectedImageTab, 0),
      subTab('gallery-template', viewModel.selectedImageTab, 1),
    ]),
    tab('settings', 'left-bar-settings', 'toolcontents', [
      subTab('left-bar-content', viewModel.selectedTool, CONTENT),
      subTab('left-bar-styles', viewModel.selectedTool, STYLE),
    ]),
  ];

  // Tabs as the ARIA pattern has them: one stop, the selected tab; the
  // arrows, Home and End move along the list and select.
  const KEYS = { ArrowLeft: -1, ArrowRight: 1, Home: 'first', End: 'last' };
  viewModel.leftBarTabKeydown = function (item, event) {
    const move = KEYS[event.key];
    if (move === undefined) return true;
    const tabs = Array.prototype.slice.call(
      event.currentTarget.parentNode.querySelectorAll('[role="tab"]')
    );
    const at = tabs.indexOf(event.currentTarget);
    let next;
    if (move === 'first') next = 0;
    else if (move === 'last') next = tabs.length - 1;
    else next = (at + move + tabs.length) % tabs.length;
    tabs[next].click();
    tabs[next].focus();
    return false;
  };

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
