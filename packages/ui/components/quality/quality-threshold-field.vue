<script>
import { CHECKS } from '~/helpers/constants/quality-checks.js';
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';

const isSet = (value) => value !== null && value !== undefined && value !== '';

// One threshold of an exception. Empty, the value below applies (the
// recommended one, or the general setting on a template), shown as the
// placeholder and in the hint.
export default {
  name: 'BsQualityThresholdField',
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
    hintId() {
      return `qx-hint-${this.checkId}-${this.name}`;
    },
    errorText() {
      if (!this.error) return '';
      const params = Object.fromEntries(
        Object.entries(this.error.params || {}).map(([key, value]) => [
          key,
          typeof value === 'number' ? this.formatNumber(value) : value,
        ])
      );
      return this.$t(this.error.key, params);
    },
    hint() {
      return this.$t(
        this.baseIsRecommended
          ? 'qualitySettings.card.recommendedHint'
          : 'qualitySettings.card.generalHint',
        {
          value: this.formatNumber(this.baseValue),
          min: this.formatNumber(this.threshold.min),
          max: this.formatNumber(this.threshold.max),
        }
      );
    },
    restoreLabel() {
      return this.$t(
        this.baseIsRecommended
          ? 'qualitySettings.card.restoreRecommended'
          : 'qualitySettings.card.restoreGeneral',
        { value: this.formatNumber(this.baseValue) }
      );
    },
  },
};
</script>

<template>
  <div class="qx-threshold">
    <v-text-field
      :value="isSetValue ? value : ''"
      :label="$t(`qualitySettings.thresholds.${checkId}.${name}`)"
      :placeholder="String(baseValue)"
      :suffix="unitName(checkId, name)"
      :error="Boolean(error)"
      :disabled="disabled"
      :data-threshold="`${checkId}.${name}`"
      :aria-describedby="hintId"
      :aria-invalid="error ? 'true' : 'false'"
      type="number"
      :step="threshold.unit === 'ratio' ? 0.1 : 1"
      outlined
      dense
      persistent-placeholder
      hide-details
      @input="$emit('input', $event)"
    >
      <template v-if="unsaved" #append>
        <span
          class="qx-threshold__dot"
          :title="$t('qualitySettings.card.unsavedValue')"
          :aria-label="$t('qualitySettings.card.unsavedValue')"
          role="img"
        />
      </template>
    </v-text-field>
    <div class="qx-threshold__hint">
      <!-- A polite live region: an error is read out once it appears, and
           again only when its text changes, not at each keystroke. -->
      <span
        :id="hintId"
        aria-live="polite"
        :class="{ 'qx-threshold__error': error }"
        >{{ error ? errorText : hint }}</span
      >
      <v-btn
        v-if="canRestore && !disabled"
        x-small
        text
        color="primary"
        class="qx-threshold__restore"
        @click="$emit('input', null)"
      >
        {{ restoreLabel }}
      </v-btn>
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
    margin: 2px 0 0 12px;
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__error {
    color: var(--v-error-base);
  }

  &__restore {
    text-transform: none;
    letter-spacing: normal;
  }

  // 5.7:1 on white: a placeholder holds the value that applies.
  ::v-deep input::placeholder {
    color: var(--gray-700) !important;
    opacity: 1;
  }

  &__dot {
    display: inline-block;
    align-self: center;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--v-warning-base);
  }
}
</style>
