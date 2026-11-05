'use strict';

const Vue = require('vue/dist/vue.common');

let uid = 0;

/**
 * A choice of the comment form (ADR 0020, board v3-comments-c2): « Sur »,
 * « Type », « Priorité ». A button that names the choice and its value, and a
 * list of options, with an optional note below them.
 *
 * At the keyboard: Enter, Space or Down opens on the chosen option, Up on the
 * last; Up, Down, Home and End move, Enter or Space choose, Escape and Tab
 * close. Escape stops here:
 * the panel would close otherwise (its binding listens to it).
 */
const CommentsMenu = Vue.component('CommentsMenu', {
  props: {
    label: { type: String, required: true },
    value: { type: String, default: null },
    // [{ value, label, hint?, icon? }]
    options: { type: Array, required: true },
    note: { type: String, default: '' },
  },
  data: () => ({ open: false, active: 0 }),
  created() {
    uid += 1;
    this.listId = `comments-menu-${uid}`;
  },
  computed: {
    chosen() {
      return (
        this.options.find((option) => option.value === this.value) ||
        this.options[0]
      );
    },
  },
  beforeDestroy() {
    document.removeEventListener('mousedown', this.onOutside, true);
  },
  methods: {
    // On the chosen option; Up opens on the last.
    show(last = false) {
      this.active = last
        ? this.options.length - 1
        : Math.max(0, this.options.indexOf(this.chosen));
      this.open = true;
      document.addEventListener('mousedown', this.onOutside, true);
      this.$nextTick(() => this.focusActive());
    },
    hide(refocus = true) {
      if (!this.open) return;
      this.open = false;
      document.removeEventListener('mousedown', this.onOutside, true);
      if (refocus) this.$nextTick(() => this.$refs.button.focus());
    },
    toggle() {
      if (this.open) this.hide();
      else this.show();
    },
    choose(option) {
      this.$emit('input', option.value);
      this.hide();
    },
    move(step) {
      const count = this.options.length;
      this.active = (this.active + step + count) % count;
      this.focusActive();
    },
    focusActive() {
      const items = this.$refs.option || [];
      if (items[this.active]) items[this.active].focus();
    },
    onOutside(event) {
      if (!this.$el.contains(event.target)) this.hide(false);
    },
    onListKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        this.hide();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.move(-1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        this.active = event.key === 'Home' ? 0 : this.options.length - 1;
        this.focusActive();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.choose(this.options[this.active]);
      } else if (event.key === 'Tab') {
        this.hide(false);
      }
    },
  },
  template: `
    <div class="comments-menu" :class="{ 'comments-menu--open': open }">
      <button
        ref="button"
        type="button"
        class="comments-menu__button"
        aria-haspopup="listbox"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="open ? listId : null"
        @click="toggle"
        @keydown.down.prevent="show()"
        @keydown.up.prevent="show(true)"
      >
        <span class="comments-menu__label">{{ label }}</span>
        <span v-if="chosen.icon" :class="['lucide', chosen.icon]" aria-hidden="true"></span>
        <span class="comments-menu__value">{{ chosen.label }}</span>
        <span :class="['lucide', open ? 'lucide-chevron-up' : 'lucide-chevron-down', 'comments-menu__chevron']" aria-hidden="true"></span>
      </button>
      <div v-if="open" class="comments-menu__popup" @keydown="onListKey">
        <ul :id="listId" role="listbox" :aria-label="label" class="comments-menu__list">
          <li
            v-for="(option, i) in options"
            ref="option"
            :key="option.value || 'none'"
            role="option"
            tabindex="-1"
            class="comments-menu__option"
            :aria-selected="option.value === value ? 'true' : 'false'"
            @click="choose(option)"
            @mouseenter="active = i"
          >
            <span v-if="option.icon" :class="['lucide', option.icon]" aria-hidden="true"></span>
            <span class="comments-menu__text">
              <span>{{ option.label }}</span>
              <span v-if="option.hint" class="comments-menu__hint">{{ option.hint }}</span>
            </span>
            <span v-if="option.value === value" class="lucide lucide-check" aria-hidden="true"></span>
          </li>
        </ul>
        <p v-if="note" class="comments-menu__note">{{ note }}</p>
      </div>
    </div>
  `,
});

module.exports = { CommentsMenu };
