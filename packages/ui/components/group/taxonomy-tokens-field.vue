<script>
import { Plus, X } from 'lucide-vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import {
  TOKENS_PER_VALUE,
  isValidDimensionName,
  tokenRows,
  tokensFromRows,
} from '~/helpers/taxonomy-builder.js';

/**
 * The design tokens of a value: named values a template reads under their name
 * (`_root_.mainColorVar`). Edited as rows; the whole set is sent on save.
 */
export default {
  name: 'BsTaxonomyTokensField',
  components: { BsTextField, LucidePlus: Plus, LucideX: X },
  props: {
    value: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return { rows: tokenRows(this.value) };
  },
  computed: {
    isFull() {
      return this.rows.length >= TOKENS_PER_VALUE;
    },
    limit() {
      return TOKENS_PER_VALUE;
    },
  },
  watch: {
    // Another value opened in the same form.
    value(tokens) {
      if (
        JSON.stringify(tokens) !== JSON.stringify(tokensFromRows(this.rows))
      ) {
        this.rows = tokenRows(tokens);
      }
    },
  },
  methods: {
    nameErrors(row) {
      return row.name && !isValidDimensionName(String(row.name).trim())
        ? [this.$t('taxonomy.values.form.tokenNameInvalid')]
        : [];
    },
    add() {
      this.rows.push({ name: '', value: '' });
    },
    remove(index) {
      this.rows.splice(index, 1);
      this.emit();
    },
    emit() {
      this.$emit('input', tokensFromRows(this.rows));
    },
  },
};
</script>

<template>
  <div class="taxonomy-tokens">
    <p class="taxonomy-tokens__label">
      {{ $t('taxonomy.values.form.tokens') }}
    </p>
    <p class="taxonomy-tokens__hint">
      {{ $t('taxonomy.values.form.tokensHint') }}
    </p>
    <div v-for="(row, index) in rows" :key="index" class="taxonomy-tokens__row">
      <bs-text-field
        v-model="row.name"
        :placeholder="$t('taxonomy.values.form.tokenNamePlaceholder')"
        :error-messages="nameErrors(row)"
        :disabled="disabled"
        @input="emit"
      />
      <bs-text-field
        v-model="row.value"
        :placeholder="$t('taxonomy.values.form.tokenValuePlaceholder')"
        :disabled="disabled"
        @input="emit"
      />
      <v-btn
        icon
        small
        :disabled="disabled"
        :aria-label="$t('global.delete')"
        @click="remove(index)"
      >
        <lucide-x :size="16" />
      </v-btn>
    </div>
    <v-btn
      text
      small
      color="accent"
      :disabled="disabled || isFull"
      @click="add"
    >
      <lucide-plus :size="16" class="mr-1" />
      {{ $t('taxonomy.values.form.addToken') }}
    </v-btn>
    <span v-if="isFull" class="taxonomy-tokens__hint">
      {{ $t('taxonomy.values.form.tokensFull', { limit }) }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-tokens {
  margin-bottom: 1rem;

  &__label {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  &__hint {
    color: var(--gray-700);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.5rem;
    align-items: start;
  }
}
</style>
