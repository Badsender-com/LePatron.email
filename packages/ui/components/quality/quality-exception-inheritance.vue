<script>
import mixinQualityTexts from '~/helpers/mixins/mixin-quality-texts.js';

// How many templates keeping their own value the card names, the others
// counted.
const KEPT_BY_NAMES = 5;

// What an exception card says about what its values inherit and pass down:
// on a template, an inherited threshold its own value overrode, and values
// equal to the general ones that will no longer follow them; in the general
// settings, the templates an unsaved change will not reach.
export default {
  name: 'BsQualityExceptionInheritance',
  mixins: [mixinQualityTexts],
  props: {
    checkId: { type: String, required: true },
    // adjustmentsOf: [{ threshold, inherited, value }].
    adjustments: { type: Array, default: () => [] },
    // How many of a template's values equal the general ones.
    equalCount: { type: Number, default: 0 },
    // The names of the templates that keep their own value.
    keptBy: { type: Array, default: () => [] },
  },
  computed: {
    adjustedTexts() {
      return this.adjustments.map((adjustment) => ({
        name: adjustment.threshold,
        text: this.$t('qualitySettings.page.adjusted', {
          level:
            this.thresholdShort(this.checkId, adjustment.threshold) ||
            this.$t('qualitySettings.thresholdsShort.default'),
          inherited: this.formatNumber(adjustment.inherited),
          value: this.formatNumber(adjustment.value),
          unit: this.unitName(this.checkId, adjustment.threshold),
        }),
      }));
    },
    keptByText() {
      const count = this.keptBy.length;
      if (!count) return '';
      const shown = this.keptBy.slice(0, KEPT_BY_NAMES);
      if (count > shown.length) {
        shown.push(
          this.$tc('qualitySettings.page.keptByOthers', count - shown.length)
        );
      }
      const names = new Intl.ListFormat(this.$i18n.locale, {
        type: 'conjunction',
      }).format(shown);
      return this.$tc('qualitySettings.page.keptBy', count, { count, names });
    },
  },
};
</script>

<template>
  <div class="qx-inheritance">
    <p v-if="equalCount" class="qx-inheritance__equal" role="status">
      {{ $tc('qualitySettings.page.equalToGeneral', equalCount) }}
    </p>
    <p v-for="item in adjustedTexts" :key="`adjusted-${item.name}`">
      {{ item.text }}
    </p>
    <p v-if="keptByText">{{ keptByText }}</p>
  </div>
</template>

<style lang="scss" scoped>
.qx-inheritance {
  color: var(--gray-700);

  p {
    margin: 0 0 4px;
  }

  &__equal {
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--surface-muted, #f5f5f5);
    color: var(--gray-900);
  }
}
</style>
