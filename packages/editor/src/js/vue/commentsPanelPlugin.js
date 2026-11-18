'use strict';

const Vue = require('vue/dist/vue.common');
const {
  CommentsPanel,
} = require('./components/comments/comments-panel');

let app = null;

/**
 * The comments panel, in Vue (ADR 0020), mounted in #toolcomments: the
 * `rightPanel` binding stays on that container and keeps Escape, hidden/inert
 * and the focus. The comments' state is the view model's
 * (ext/badsender-comments.js), set up before the bindings.
 */
module.exports = {
  init(vm) {
    if (!vm.commentsStore || !document.getElementById('comments-panel')) return;
    Vue.component('CommentsPanelPlugin', {
      components: { CommentsPanel },
      data: () => ({ viewModel: vm }),
      template: '<comments-panel :vm="viewModel"></comments-panel>',
    });
    app = new Vue({ el: '#comments-panel' });
  },
  // Called by the template loader when the editor swaps templates.
  dispose() {
    if (app) {
      app.$destroy();
      app = null;
    }
  },
};
