const axios = require('axios');

// Fetches the list of block names that have an active feed mapping for the
// current mailing's template, and exposes it on the viewModel so plain
// Knockout bindings (the toolbar icon, the template-blocks palette overlay)
// can gate on it without needing a Vue component in the loop. Must run
// AFTER badsender-current-mailing.js in the extensions array — it depends
// on viewModel.currentMailing already existing so it can subscribe to it.
module.exports = () => {
  function viewModel(viewModel) {
    viewModel.feedMappableBlockNames = ko.observableArray([]);

    // Called with two different shapes depending on the caller: the
    // template-blocks palette (`foreach: blockDefs`) hands over $data — the
    // block-def object itself, whose `.type` is an observable — while the
    // canvas toolbar (`foreach: parent.blocks`) hands over $rawData — the
    // array element AS STORED, which for that array is the observable
    // WRAPPING the block object, not the object itself (same distinction
    // that trips up .blocks.remove() elsewhere in this file). Unwrapping
    // blockData itself first (a no-op for the palette's plain object) makes
    // this work for both.
    viewModel.isFeedMappableBlock = function (blockData) {
      const block = ko.utils.unwrapObservable(blockData);
      if (!block) return false;
      const type = ko.utils.unwrapObservable(block.type);
      return viewModel.feedMappableBlockNames().indexOf(type) !== -1;
    };

    function fetchMappableBlockNames(mailing) {
      const templateId = mailing && mailing.templateId;
      if (!templateId) {
        viewModel.feedMappableBlockNames([]);
        return;
      }
      axios
        .get(`/api/feed-mappings?templateId=${templateId}`)
        .then((response) => {
          const names = (response.data.items || []).map((m) => m.blockName);
          viewModel.feedMappableBlockNames(
            names.filter((name, index) => names.indexOf(name) === index)
          );
        })
        .catch(() => viewModel.feedMappableBlockNames([]));
    }

    if (viewModel.currentMailing) {
      viewModel.currentMailing.subscribe(fetchMappableBlockNames);
      fetchMappableBlockNames(viewModel.currentMailing());
    }
  }

  return { viewModel };
};
