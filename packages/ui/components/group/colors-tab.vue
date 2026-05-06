<script>
import BsColorScheme from '~/components/group/color-scheme';
import BsFormSection from '~/components/layout/BsFormSection.vue';
import { Palette } from 'lucide-vue';

export default {
  name: 'BsGroupColorsTab',
  components: {
    BsColorScheme,
    BsFormSection,
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
      <bs-form-section last>
        <template #icon>
          <lucide-palette :size="20" />
        </template>
        <template #title>
          {{ $t('colors.palette') }}
        </template>
        <template #description>
          {{ $t('colors.paletteDescription') }}
        </template>

        <bs-color-scheme v-model="colorScheme" :disabled="disabled" />

        <p class="colors-hint mt-4">
          <span class="colors-hint__icon">ⓘ</span>
          {{ $t('colors.hint', { count: colorCount, max: 21 }) }}
        </p>
      </bs-form-section>
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
