'use strict';

const Vue = require('vue/dist/vue.common');
const { findMentionContext } = require('../../../ext/comments-utils');

const MAX_SUGGESTIONS = 5;
let uid = 0;

/**
 * The text of a comment, with mentions (ADR 0020): typing « @ » suggests the
 * company's users, the name typed after it filters them. A chosen user shows
 * as « @Name » and is told to the panel, which stores the mention.
 *
 * A mention starts a word: « ana@example » suggests no one. At the keyboard:
 * Up and Down move among the suggestions, Enter or Tab choose, Escape closes
 * them without closing the panel. While an input method composes, keys are
 * its own.
 */
const MentionTextarea = Vue.component('MentionTextarea', {
  props: {
    value: { type: String, default: '' },
    // [{ _id | id, name, email }]
    users: { type: Array, default: () => [] },
    placeholder: { type: String, default: '' },
    label: { type: String, required: true },
    rows: { type: Number, default: 3 },
    t: { type: Function, default: null },
  },
  data: () => ({ query: null, at: -1, active: 0 }),
  created() {
    uid += 1;
    this.listId = `mention-list-${uid}`;
  },
  computed: {
    suggestions() {
      if (this.query === null) return [];
      const query = this.query.toLowerCase();
      return this.users
        .filter((user) => user.name && user.name.toLowerCase().includes(query))
        .slice(0, MAX_SUGGESTIONS);
    },
    open() {
      return this.suggestions.length > 0;
    },
  },
  methods: {
    focus() {
      this.$refs.input.focus();
    },
    // The mention being typed where the caret is now, if any.
    contextAt() {
      const { value, selectionStart } = this.$refs.input;
      const context = findMentionContext(value, selectionStart);
      if (!context) return null;
      // A mention starts a word: not the middle of an address.
      const before = value.charAt(context.atIndex - 1);
      return context.atIndex === 0 || /\s/.test(before) ? context : null;
    },
    follow() {
      const context = this.contextAt();
      this.query = context ? context.query : null;
      this.at = context ? context.atIndex : -1;
    },
    onInput(event) {
      this.$emit('input', event.target.value);
      this.follow();
      this.active = 0;
    },
    close() {
      this.query = null;
    },
    insert(user) {
      // Read again where the caret is: it may have moved since the last key
      // typed. What is typed, not the prop: the panel may not have passed it
      // back yet.
      const context = this.contextAt();
      if (!context) {
        this.close();
        return;
      }
      const input = this.$refs.input;
      const cursor = input.selectionStart;
      const before = input.value.slice(0, context.atIndex);
      const after = input.value.slice(cursor);
      const shown = `@${user.name}`;
      this.$emit('input', `${before}${shown} ${after}`);
      this.$emit('mention', {
        name: user.name,
        userId: user._id || user.id,
        displayText: shown,
      });
      this.close();
      this.$nextTick(() => {
        const position = before.length + shown.length + 1;
        input.focus();
        input.setSelectionRange(position, position);
      });
    },
    onKey(event) {
      if (!this.open || event.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const count = this.suggestions.length;
        this.active = (this.active + step + count) % count;
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.insert(this.suggestions[this.active]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      }
    },
  },
  template: `
    <div class="mention-textarea">
      <textarea
        ref="input"
        class="comments-textarea"
        :rows="rows"
        :value="value"
        :placeholder="placeholder"
        :aria-label="label"
        aria-autocomplete="list"
        :aria-controls="open ? listId : null"
        :aria-activedescendant="open ? listId + '-' + active : null"
        @input="onInput"
        @keydown="onKey"
        @keyup="open && follow()"
        @click="open && follow()"
        @blur="close"
      ></textarea>
      <ul v-show="open" :id="listId" role="listbox" :aria-label="t ? t('comments-mention-list') : label" class="mention-textarea__list">
        <li
          v-for="(user, i) in suggestions"
          :id="listId + '-' + i"
          :key="user._id || user.id"
          role="option"
          class="mention-textarea__option"
          :aria-selected="i === active ? 'true' : 'false'"
          @mousedown.prevent="insert(user)"
        >
          <span class="mention-textarea__name">{{ user.name }}</span>
          <span class="mention-textarea__email">{{ user.email }}</span>
        </li>
      </ul>
    </div>
  `,
});

module.exports = { MentionTextarea };
