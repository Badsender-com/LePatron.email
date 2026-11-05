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
 * At the keyboard: Up and Down move among the suggestions, Enter or Tab
 * choose, Escape closes them without closing the panel.
 */
const MentionTextarea = Vue.component('MentionTextarea', {
  props: {
    value: { type: String, default: '' },
    // [{ _id | id, name, email }]
    users: { type: Array, default: () => [] },
    placeholder: { type: String, default: '' },
    label: { type: String, required: true },
    rows: { type: Number, default: 3 },
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
    onInput(event) {
      const { value, selectionStart } = event.target;
      this.$emit('input', value);
      const context = findMentionContext(value, selectionStart);
      this.query = context ? context.query : null;
      this.at = context ? context.atIndex : -1;
      this.active = 0;
    },
    close() {
      this.query = null;
    },
    insert(user) {
      // What is typed, not the prop: the panel may not have passed it back yet.
      const input = this.$refs.input;
      const cursor = input.selectionStart;
      const before = input.value.slice(0, this.at);
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
      if (!this.open) return;
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
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="listId"
        :aria-activedescendant="open ? listId + '-' + active : null"
        @input="onInput"
        @keydown="onKey"
        @blur="close"
      ></textarea>
      <ul v-show="open" :id="listId" role="listbox" class="mention-textarea__list">
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
