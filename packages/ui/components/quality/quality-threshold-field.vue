<script>
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';
import BsTextField from '~/components/form/bs-text-field.vue';

const isSet = (value) => value !== null && value !== undefined && value !== '';

// One threshold of an exception. Empty, the value below applies (the
// recommended one, or the general setting on a template), shown as the
// placeholder and in the hint.
export default {
  name: 'BsQualityThresholdField',
  components: { BsTextField },
  mixins: [mixinQualityTexts],
  props: {
    checkId: { type: String, required: true },
    name: { type: String, required: true },
    value: { type: [Number, String], default: null },
    savedValue: { type: Number, default: null },
    baseValue: { type: Number, required: true },
    // The base is the recommended value (general settings) or the general
    // setting (a template).
    baseIsRecommended: { type: Boolean, default: true },
    error: { type: Object, default: null },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    threshold() {
      return CHECKS[this.checkId].thresholds[this.name];
    },
    isSetValue() {
      return isSet(this.value);
    },
    canRestore() {
      return isSet(this.value) && Number(this.value) !== this.baseValue;
    },
    unsaved() {
      const value = isSet(this.value) ? Number(this.value) : null;
      return value !== this.savedValue;
    },
    errors() {
      return this.error ? [this.$t(this.error.key, this.error.params)] : [];
    },
    hint() {
      return this.$t(
        this.baseIsRecommended
          ? 'qualitySettings.card.recommendedHint'
          : 'qualitySettings.card.generalHint',
        {
          value: this.baseValue,
          min: this.threshold.min,
          max: this.threshold.max,
        }
      );
    },
  },
};
</script>

<template>
  <div class="qx-threshold">
    <bs-text-field
      :value="isSetValue ? value : ''"
      :label="$t(`qualitySettings.thresholds.${checkId}.${name}`)"
      :placeholder="String(baseValue)"
      :suffix="unitName(checkId, name)"
      :error-messages="errors"
      :disabled="disabled"
      :data-threshold="`${checkId}.${name}`"
      type="number"
      :step="threshold.unit === 'ratio' ? 0.1 : 1"
      outlined
      dense
      hide-details="auto"
      @input="$emit('input', $event)"
    />
    <div class="qx-threshold__hint">
      <span
        v-if="unsaved"
        class="qx-threshold__dot"
        :title="$t('qualitySettings.card.unsavedValue')"
        :aria-label="$t('qualitySettings.card.unsavedValue')"
        role="img"
      />
      {{ hint }}
      <a
        v-if="canRestore && !disabled"
        href="#"
        @click.prevent="$emit('input', null)"
      >
        {{ $t('qualitySettings.card.restore', { value: baseValue }) }}
      </a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.qx-threshold {
  flex: 1 1 260px;
  max-width: 360px;

  &__hint {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin-top: 4px;
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--v-warning-base);
  }
}
</style>
