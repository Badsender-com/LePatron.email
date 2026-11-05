'use strict';

const Vue = require('vue/dist/vue.common');
const isEmail = require('validator/lib/isEmail');

let uid = 0;
const MAX_SUGGESTIONS = 5;

/**
 * The one « Destinataires » field of a test (board q4): addresses and a saved
 * list, as chips. An address is added with Enter, a comma, a semicolon or a
 * space, or when the field is left; a list is chosen among those whose name
 * is typed. The server takes one list per send: choosing another replaces it.
 * Backspace in the empty field removes the last chip.
 *
 * v-model: [{ kind: 'email', value } | { kind: 'list', code, label, count }]
 */
const RecipientsField = Vue.component('RecipientsField', {
  props: {
    value: { type: Array, default: () => [] },
    // The saved lists: [{ code, label, count? }]
    lists: { type: Array, default: () => [] },
    label: { type: String, required: true },
    t: { type: Function, required: true },
  },
  data: () => ({ draft: '', invalid: false, active: 0 }),
  created() {
    uid += 1;
    this.inputId = `recipients-${uid}`;
    this.listId = `recipients-lists-${uid}`;
    this.helpId = `recipients-help-${uid}`;
  },
  computed: {
    count() {
      return this.value.reduce(
        (sum, chip) => sum + (chip.kind === 'list' ? chip.count || 0 : 1),
        0
      );
    },
    suggestions() {
      const query = this.draft.trim().toLowerCase();
      if (!query || query.includes('@')) return [];
      return this.lists
        .filter((list) => list.label.toLowerCase().includes(query))
        .slice(0, MAX_SUGGESTIONS);
    },
  },
  methods: {
    update(chips) {
      this.$emit('input', chips);
    },
    // What is typed, as addresses; what is not one stays, marked.
    commit() {
      const parts = this.draft.split(/[\s,;]+/).filter(Boolean);
      if (!parts.length) return true;
      const known = new Set(this.value.map((chip) => chip.value));
      const added = parts
        .filter((part) => isEmail(part) && !known.has(part))
        .map((part) => ({ kind: 'email', value: part }));
      const rest = parts.filter((part) => !isEmail(part));
      if (added.length) this.update(this.value.concat(added));
      this.draft = rest.join(' ');
      this.invalid = rest.length > 0;
      return !this.invalid;
    },
    choose(list) {
      const others = this.value.filter((chip) => chip.kind !== 'list');
      this.update(others.concat({ kind: 'list', ...list }));
      this.draft = '';
      this.invalid = false;
      this.$refs.input.focus();
    },
    remove(index) {
      this.update(this.value.filter((_chip, i) => i !== index));
      this.$refs.input.focus();
    },
    onKey(event) {
      const open = this.suggestions.length > 0;
      if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const total = this.suggestions.length;
        this.active = (this.active + step + total) % total;
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (open) this.choose(this.suggestions[this.active]);
        else this.commit();
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        this.draft = '';
      } else if (event.key === 'Backspace' && !this.draft && this.value.length) {
        this.remove(this.value.length - 1);
      }
    },
    onInput(event) {
      this.draft = event.target.value;
      this.invalid = false;
      this.active = 0;
      if (/[,;]\s*$|\s$/.test(this.draft) && this.draft.includes('@')) this.commit();
    },
    chipLabel(chip) {
      if (chip.kind === 'email') return chip.value;
      return chip.count ? `${chip.label} · ${chip.count}` : chip.label;
    },
  },
  template: `
    <div class="qc-recipients">
      <label :for="inputId" class="qc-field__label">{{ label }}</label>
      <div class="qc-recipients__box" :class="{ 'qc-recipients__box--invalid': invalid }" @click="$refs.input.focus()">
        <span v-for="(chip, i) in value" :key="chip.kind + (chip.value || chip.code)" class="qc-recipients__chip">
          <span v-if="chip.kind === 'list'" class="lucide lucide-users" aria-hidden="true"></span>{{ chipLabel(chip) }}
          <button type="button" class="qc-recipients__remove" :aria-label="t('quality-recipient-remove', { name: chipLabel(chip) })" @click.stop="remove(i)">
            <span class="lucide lucide-x" aria-hidden="true"></span>
          </button>
        </span>
        <input
          :id="inputId"
          ref="input"
          class="qc-recipients__input"
          type="text"
          autocomplete="off"
          :value="draft"
          :placeholder="t('quality-recipients-placeholder')"
          :aria-invalid="invalid ? 'true' : 'false'"
          :aria-describedby="helpId"
          aria-autocomplete="list"
          :aria-controls="suggestions.length ? listId : null"
          :aria-activedescendant="suggestions.length ? listId + '-' + active : null"
          @input="onInput"
          @keydown="onKey"
          @blur="commit"
        >
      </div>
      <ul v-show="suggestions.length" :id="listId" role="listbox" :aria-label="t('Saved list of addresses')" class="qc-recipients__lists">
        <li
          v-for="(list, i) in suggestions"
          :id="listId + '-' + i"
          :key="list.code"
          role="option"
          :aria-selected="i === active ? 'true' : 'false'"
          class="qc-recipients__option"
          @mousedown.prevent="choose(list)"
        >
          <span class="lucide lucide-users" aria-hidden="true"></span>{{ chipLabel(list) }}
        </li>
      </ul>
      <p :id="helpId" class="qc-field__help" :class="{ 'qc-field__help--error': invalid }" aria-live="polite">
        {{ invalid ? t('emails-invalid') : t('quality-recipients-help', { count: count }) }}
      </p>
    </div>
  `,
});

module.exports = { RecipientsField };
