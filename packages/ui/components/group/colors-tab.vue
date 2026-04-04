<script>
import BsColorScheme from '~/components/group/color-scheme';
import { Palette } from 'lucide-vue';

export default {
  name: 'BsGroupColorsTab',
  components: {
    BsColorScheme,
    LucidePalette: Palette,
  },
  props: {
    value: {
      type: Object,
      default: () => ({}),
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    colorScheme: {
      get() {
        return this.value.colorScheme || [];
      },
      set(newColorScheme) {
        this.$emit('input', { ...this.value, colorScheme: newColorScheme });
      },
    },
    colorCount() {
      return this.colorScheme.length;
    },
  },
  methods: {
    onSave() {
      this.$emit('save');
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <div class="form-section">
        <div class="form-section__header">
          <h3 class="form-section__title">
            <lucide-palette :size="20" class="mr-2" />
            {{ $t('colors.palette') }}
          </h3>
          <p class="form-section__description">
            {{ $t('colors.paletteDescription') }}
          </p>
        </div>

        <bs-color-scheme v-model="colorScheme" :disabled="disabled" />

        <p class="colors-hint mt-4">
          <span class="colors-hint__icon">ⓘ</span>
          {{ $t('colors.hint', { count: colorCount, max: 21 }) }}
        </p>
      </div>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn
        color="accent"
        elevation="0"
        :loading="loading"
        :disabled="disabled || loading"
        @click="onSave"
      >
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style lang="scss" scoped>
.form-section {
  &__header {
    margin-bottom: 1.5rem;
  }

  &__title {
    display: flex;
    align-items: center;
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    margin-bottom: 0.25rem;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0;
  }
}

.colors-hint {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.5);

  &__icon {
    margin-right: 0.5rem;
    font-size: 0.875rem;
  }
}
</style>
