'use strict'

var $ = require('jquery')
var ko = require('knockout')
var console = require('console')

function selectItem(viewModel) {
  // Used by editor and main "converter" to support item selection
  // • this is an augmented version of mosaico original viewModel.selectItem in viewmodel.js
  // • it should prevent duplicated blocks on theme variables groups
  viewModel.selectItem = function(valueAccessor, item, block) {
    const hasBlock = typeof block !== 'undefined'
    if (hasBlock) {
      const hasTheme = block.theme ? block.theme() : block.theme
      // prevent selection block on themed block
      if (hasTheme) return
    }

    var val = ko.utils.peekObservable(valueAccessor)
    if (hasBlock) viewModel.selectBlock(block, false, true)
    if (val != item) {
      valueAccessor(item)
      // On selectItem if we were on "Blocks" toolbox tab we move to "Content" toolbox tab.
      if (item !== null && viewModel.selectedTool() === 0)
        viewModel.selectedTool(1)
    }
    return false
  }.bind(viewModel, viewModel.selectedItem)
}

module.exports = selectItem
