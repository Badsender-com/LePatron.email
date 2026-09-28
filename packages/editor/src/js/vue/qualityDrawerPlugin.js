const Vue = require('vue/dist/vue.common');
const { QualityDrawer } = require('./components/quality-drawer/quality-drawer');
const { installQualityReview } = require('../ext/quality/quality-review');

module.exports = {
  viewModel(vm, ko) {
    // Before bindings: the toolbar button and the panel bind to this state.
    installQualityReview(vm, ko);
  },
  init(vm) {
    // The quality drawer and the comments panel share the right side of the
    // editor: opening one closes the other.
    if (vm.showComments) {
      vm.showQuality.subscribe((isOpen) => isOpen && vm.showComments(false));
      vm.showComments.subscribe((isOpen) => isOpen && vm.showQuality(false));
    }

    Vue.component('QualityDrawerPlugin', {
      components: { QualityDrawer },
      data: () => ({ viewModel: vm }),
      template: '<quality-drawer :vm="viewModel"></quality-drawer>',
    });

    new Vue({ el: '#quality-drawer' });
  },
};
