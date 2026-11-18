'use strict';

const Vue = require('vue/dist/vue.common');
const { segmentsOf } = require('../../../ext/comments/comments-thread');

/**
 * A comment's text, its mentions shown as « @Name »: rendered as text, never
 * as markup, whatever the comment holds. Line breaks are kept by the style.
 */
const CommentText = Vue.component('CommentText', {
  props: {
    text: { type: String, default: '' },
  },
  computed: {
    segments() {
      return segmentsOf(this.text);
    },
  },
  template: `
    <p class="comment-text"><template v-for="(piece, i) in segments"><span v-if="piece.mention" :key="i" class="comment-mention">{{ piece.text }}</span><template v-else>{{ piece.text }}</template></template></p>
  `,
});

module.exports = { CommentText };
