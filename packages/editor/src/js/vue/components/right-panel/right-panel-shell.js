'use strict';

const Vue = require('vue/dist/vue.common');

/**
 * The shell of a right panel (ADR 0020): one header, one body, one foot, the
 * same in « Commentaires », « Tester l'email » and « Outils IA », which only
 * fill them.
 *
 * - The header carries the title alone: the panel rail already says which
 *   panel this is. A count may follow the title; on a second level (an AI
 *   action, a result), a back arrow precedes it. Closing is always at the
 *   same place.
 * - The body is the only part that scrolls; an inner navigation (tabs) goes
 *   in `nav`, above it.
 * - The foot carries the panel's actions, the main one on the right; an empty
 *   foot is not drawn.
 *
 * Opening, closing, Escape, `hidden`/`inert` and the focus on open and close
 * stay with the `rightPanel` binding on the panel's container
 * (ext/right-panel.js): the close button emits `close`, and the panel closes
 * through it; a panel may first keep what the user was writing.
 */
const RightPanelShell = Vue.component('RightPanelShell', {
  props: {
    titleId: { type: String, required: true },
    title: { type: String, required: true },
    closeLabel: { type: String, required: true },
    // Shown after the title when not null; said with its label, or as is.
    count: { type: Number, default: null },
    countLabel: { type: String, default: '' },
    // A second level: the back arrow, named by this label, emits `back`.
    backLabel: { type: String, default: '' },
  },
  methods: {
    // The title is announced when the panel changes level.
    focusTitle() {
      this.$nextTick(() => {
        if (this.$refs.title) this.$refs.title.focus();
      });
    },
  },
  template: `
    <section class="right-panel-shell" role="dialog" aria-modal="false" :aria-labelledby="titleId">
      <header class="right-panel-shell__header">
        <button
          v-if="backLabel"
          type="button"
          class="qc-icon-button right-panel-shell__back"
          :aria-label="backLabel"
          :title="backLabel"
          @click="$emit('back')"
        >
          <span class="lucide lucide-arrow-left" aria-hidden="true"></span>
        </button>
        <h2 :id="titleId" ref="title" tabindex="-1" class="right-panel-shell__title">{{ title }}</h2>
        <!-- After the title: the count, or what the panel puts in its place. -->
        <slot name="title-after">
          <span v-if="count !== null" class="right-panel-shell__count">
          <span aria-hidden="true">{{ count }}</span>
          <span class="qc-sr-only">{{ countLabel || count }}</span>
        </span>
        </slot>
        <button
          type="button"
          class="qc-icon-button right-panel-shell__close"
          :aria-label="closeLabel"
          :title="closeLabel"
          @click="$emit('close')"
        >
          <span class="lucide lucide-x" aria-hidden="true"></span>
        </button>
      </header>
      <div v-if="$slots.nav" class="right-panel-shell__nav">
        <slot name="nav"></slot>
      </div>
      <div class="right-panel-shell__body">
        <slot></slot>
      </div>
      <footer v-if="$slots.footer" class="right-panel-shell__footer">
        <slot name="footer"></slot>
      </footer>
    </section>
  `,
});

module.exports = { RightPanelShell };
