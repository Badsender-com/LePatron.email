<script>
import BsSelect from '~/components/form/bs-select.vue';
import {
  codeOptions,
  splitLocale,
  joinLocale,
} from '~/helpers/taxonomy-roles.js';

/**
 * The normalised code of a value whose dimension has a role (ADR-0023): a
 * language, a country, or a locale picked as a language and an optional
 * country. Named in the admin's language; the identifier beside it stays free.
 */
export default {
  name: 'BsTaxonomyCodeField',
  components: { BsSelect },
  props: {
    // `language`, `country` or `locale`.
    role: { type: String, required: true },
    value: { type: String, default: null },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    languages() {
      return codeOptions('language', this.$i18n.locale);
    },
    countries() {
      return codeOptions('country', this.$i18n.locale);
    },
    locale() {
      return splitLocale(this.value);
    },
  },
  methods: {
    setLocale(part, code) {
      this.$emit(
        'input',
        joinLocale({ ...this.locale, [part]: code || null }) || null
      );
    },
  },
};
</script>

<template>
  <div v-if="role === 'locale'" class="taxonomy-code">
    <bs-select
      :value="locale.language"
      :label="$t('taxonomy.values.form.codeLanguage')"
      :items="languages"
      :hint="$t('taxonomy.values.form.codeHint')"
      :disabled="disabled"
      clearable
      @input="setLocale('language', $event)"
    />
    <bs-select
      :value="locale.country"
      :label="$t('taxonomy.values.form.codeCountry')"
      :items="countries"
      :disabled="disabled || !locale.language"
      clearable
      @input="setLocale('country', $event)"
    />
  </div>
  <bs-select
    v-else
    :value="value"
    :label="$t(`taxonomy.values.form.code.${role}`)"
    :items="role === 'country' ? countries : languages"
    :hint="$t('taxonomy.values.form.codeHint')"
    :disabled="disabled"
    clearable
    @input="$emit('input', $event || null)"
  />
</template>

<style lang="scss" scoped>
.taxonomy-code {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
</style>
