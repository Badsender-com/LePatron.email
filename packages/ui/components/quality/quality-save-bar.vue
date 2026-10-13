<script>
// The save button of a "Contrôle qualité" page, with how many changes wait.
export default {
  name: 'BsQualitySaveBar',
  props: {
    changeCount: { type: Number, default: 0 },
    loading: { type: Boolean, default: false },
    invalid: { type: Boolean, default: false },
  },
};
</script>

<template>
  <div class="qx-save-bar">
    <span class="qx-save-bar__status" role="status">
      {{ $tc('qualitySettings.unsaved.status', changeCount) }}
    </span>
    <v-btn text :disabled="loading || !changeCount" @click="$emit('cancel')">
      {{ $t('qualitySettings.unsaved.cancel') }}
    </v-btn>
    <v-btn
      color="accent"
      elevation="0"
      :loading="loading"
      :disabled="loading || !changeCount || invalid"
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
    margin-right: auto;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }
}
</style>
