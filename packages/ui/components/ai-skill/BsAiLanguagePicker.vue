<script>
/**
 * BsAiLanguagePicker — searchable multi-select over the full ISO 639-1 list.
 * A plain <select> is unusable with ~184 entries (dropdown overlays the field,
 * no filtering), so this uses a v-autocomplete with chips. Search matches on
 * BOTH the code and the French name, accent-insensitively.
 */
import { isoLanguageOptions } from '~/helpers/iso-languages.js';

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export default {
  name: 'BsAiLanguagePicker',
  inheritAttrs: false,
  props: {
    value: { type: Array, default: () => [] },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return { searchText: '' };
  },
  computed: {
    options() {
      return isoLanguageOptions();
    },
  },
  methods: {
    // item.text is "fr — Français"; matching it covers both code and name.
    filter(item, queryText) {
      return normalize(item.text).includes(normalize(queryText));
    },
    onInput(event) {
      // Clear the typed search on selection so it doesn't linger (§2).
      this.searchText = '';
      this.$emit('input', event);
    },
  },
};
</script>

<template>
  <div class="bs-ai-language-picker">
    <label v-if="label" class="bs-ai-language-picker__label">{{ label }}</label>
    <v-autocomplete
      :value="value"
      :search-input.sync="searchText"
      :items="options"
      item-text="text"
      item-value="value"
      :filter="filter"
      :disabled="disabled"
      multiple
      chips
      small-chips
      deletable-chips
      clearable
      solo
      flat
      outlined
      dense
      hide-details="auto"
      @input="onInput"
    />
    <div v-if="hint" class="bs-ai-language-picker__hint">
      {{ hint }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-ai-language-picker {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--gray-700);
    margin-bottom: 0.375rem;
  }

  &__hint {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
    margin-top: 0.375rem;
  }
}
</style>
