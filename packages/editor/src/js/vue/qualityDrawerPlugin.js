const Vue = require('vue/dist/vue.common');
const { QualityDrawer } = require('./components/quality-drawer/quality-drawer');
const { installQualityReview } = require('../ext/quality/quality-review');

let app = null;

module.exports = {
  viewModel(vm, ko) {
    // Before bindings: the toolbar button and the panel bind to this state.
    installQualityReview(vm, ko);
  },
  init(vm) {
    // Opening the drawer closes the comments, and the reverse: both are flags
    // of the editor's one right panel (ext/right-panel.js).
    Vue.component('QualityDrawerPlugin', {
      components: { QualityDrawer },
      data: () => ({ viewModel: vm }),
      template: '<quality-drawer :vm="viewModel"></quality-drawer>',
    });

    app = new Vue({ el: '#quality-drawer' });
  },
  // Called by the template loader when the editor swaps templates: the drawer
  // lets go of the view model it subscribed to.
  dispose() {
    if (app) {
      app.$destroy();
      app = null;
    }
  },
};
