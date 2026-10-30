<script>
import { AlertTriangle } from 'lucide-vue';

// The save button of a "Contrôle qualité" page, with how many changes wait.
export default {
  name: 'BsQualitySaveBar',
  components: { AlertTriangle },
  props: {
    changeCount: { type: Number, default: 0 },
    loading: { type: Boolean, default: false },
    // How many values are not valid.
    invalidCount: { type: Number, default: 0 },
  },
};
</script>

<template>
  <div class="qx-save-bar">
    <span class="qx-save-bar__status" role="status">
      <template v-if="invalidCount">
        <alert-triangle :size="16" class="qx-save-bar__alert" />
        {{ $tc('qualitySettings.unsaved.invalid', invalidCount) }}
      </template>
      <template v-else>
        <span v-if="changeCount" class="qx-save-bar__dot" />
        {{ $tc('qualitySettings.unsaved.status', changeCount) }}
      </template>
    </span>
    <v-btn
      text
      color="accent"
      :disabled="loading || !changeCount"
      @click="$emit('cancel')"
    >
      {{ $t('global.cancel') }}
    </v-btn>
    <v-btn
      color="accent"
      elevation="0"
      :loading="loading"
      :disabled="loading || !changeCount || invalidCount > 0"
      @click="$emit('save')"
    >
      {{ $t('global.save') }}
    </v-btn>
  </div>
</template>

<style lang="scss" scoped>
.qx-save-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__alert {
    color: var(--v-error-base);
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--v-warning-base);
  }
}
</style>
