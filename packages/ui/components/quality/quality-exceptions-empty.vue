<script>
import { ShieldCheck } from 'lucide-vue';

// What a level with no exception shows: nothing differs from what applies.
export default {
  name: 'BsQualityExceptionsEmpty',
  components: { ShieldCheck },
  props: {
    isGeneral: { type: Boolean, default: true },
  },
};
</script>

<template>
  <div class="qx-empty">
    <shield-check :size="32" class="qx-empty__icon" />
    <p class="qx-empty__title">
      {{
        isGeneral
          ? $t('qualitySettings.general.empty')
          : $t('qualitySettings.template.empty')
      }}
    </p>
    <p v-if="isGeneral" class="qx-empty__detail">
      {{ $t('qualitySettings.general.emptyDetail') }}
    </p>
    <v-btn color="accent" outlined @click="$emit('add')">
      {{ $t('qualitySettings.addException') }}
    </v-btn>
  </div>
</template>

<style lang="scss" scoped>
.qx-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 32px 24px;
  text-align: center;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  font-size: 0.875rem;

  p {
    margin: 0;
  }

  .v-btn {
    margin-top: 12px;
  }

  &__icon {
    margin-bottom: 8px;
    color: var(--gray-700);
  }

  &__title {
    color: var(--gray-900);
  }

  &__detail {
    color: var(--gray-700);
  }
}
</style>
