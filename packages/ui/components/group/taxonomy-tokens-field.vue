<script>
import { Plus, X } from 'lucide-vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import {
  TOKENS_PER_VALUE,
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_VALUE_MAX_LENGTH,
  tokenRows,
  tokensFromRows,
  tokenRowErrors,
} from '~/helpers/taxonomy-builder.js';

// The message of each reason tokenRowErrors gives, under `taxonomy.values.form`.
const NAME_MESSAGES = {
  required: 'tokenNameRequired',
  invalid: 'tokenNameInvalid',
  tooLong: 'tokenNameTooLong',
  reserved: 'tokenNameReserved',
  duplicate: 'tokenNameDuplicate',
};
const VALUE_MESSAGES = {
  required: 'tokenValueRequired',
  tooLong: 'tokenValueTooLong',
  unsafe: 'tokenValueUnsafe',
};

/**
 * The design tokens of a value: named values a template reads under their name
 * (`_root_.mainColorVar`). Edited as rows; the whole set is sent on save.
 *
 * A row's errors show once it has been left, or once a save was tried: the
 * form calls `validate()` and sends nothing while a row is wrong. Mounted
 * afresh at each opening of the form (its `key`), so no row is left over from
 * the previous one.
 */
export default {
  name: 'BsTaxonomyTokensField',
  components: { BsTextField, LucidePlus: Plus, LucideX: X },
  props: {
    value: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
    // A refusal only the server can decide, already translated: a token named
    // like one of the company's dimensions.
    serverError: { type: String, default: null },
  },
  data() {
    return {
      rows: tokenRows(this.value).map((row) => ({ ...row, touched: false })),
      submitted: false,
    };
  },
  computed: {
    isFull() {
      return this.rows.length >= TOKENS_PER_VALUE;
    },
    limit() {
      return TOKENS_PER_VALUE;
    },
    nameMaxLength() {
      return TOKEN_NAME_MAX_LENGTH;
    },
    valueMaxLength() {
      return TOKEN_VALUE_MAX_LENGTH;
    },
    errors() {
      return tokenRowErrors(this.rows);
    },
    isValid() {
      return this.errors.every((error) => !error.name && !error.value);
    },
  },
  methods: {
    shown(index) {
      return this.submitted || this.rows[index].touched;
    },
    nameErrors(index) {
      const reason = this.errors[index].name;
      if (!reason || !this.shown(index)) return [];
      return [
        this.$t(`taxonomy.values.form.${NAME_MESSAGES[reason]}`, {
          max: TOKEN_NAME_MAX_LENGTH,
        }),
      ];
    },
    valueErrors(index) {
      const reason = this.errors[index].value;
      if (!reason || !this.shown(index)) return [];
      return [
        this.$t(`taxonomy.values.form.${VALUE_MESSAGES[reason]}`, {
          max: TOKEN_VALUE_MAX_LENGTH,
        }),
      ];
    },
    /**
     * Show every row's errors, for a save the form is about to send.
     *
     * @returns {boolean} whether the rows may be sent
     */
    validate() {
      this.submitted = true;
      return this.isValid;
    },
    add() {
      this.rows.push({ name: '', value: '', touched: false });
    },
    remove(index) {
      this.rows.splice(index, 1);
      this.emit();
    },
    touch(index) {
      this.rows[index].touched = true;
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
      <!-- Labels hidden from sight, not from screen readers: a row of two
           bare inputs would have no name. -->
      <bs-text-field
        v-model="row.name"
        :label="$t('taxonomy.values.form.tokenName')"
        hide-label
        :placeholder="$t('taxonomy.values.form.tokenNamePlaceholder')"
        :error-messages="nameErrors(index)"
        :maxlength="nameMaxLength"
        :disabled="disabled"
        @input="emit"
        @blur="touch(index)"
      />
      <bs-text-field
        v-model="row.value"
        :label="$t('taxonomy.values.form.tokenValue')"
        hide-label
        :placeholder="$t('taxonomy.values.form.tokenValuePlaceholder')"
        :error-messages="valueErrors(index)"
        :maxlength="valueMaxLength"
        :counter="valueMaxLength"
        :disabled="disabled"
        @input="emit"
        @blur="touch(index)"
      />
      <v-btn
        class="taxonomy-tokens__remove"
        icon
        small
        :disabled="disabled"
        :aria-label="$t('global.delete')"
        @click="remove(index)"
      >
        <lucide-x :size="16" />
      </v-btn>
    </div>
    <p
      v-if="serverError"
      class="taxonomy-tokens__error error--text"
      role="alert"
    >
      {{ serverError }}
    </p>
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

  &__error {
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }

  // Centred on the input rather than on the field: an error message under the
  // name would otherwise drag the button down with it.
  &__remove {
    margin-top: 6px;
  }
}
</style>
