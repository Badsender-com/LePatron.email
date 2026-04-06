<script>
import { MoreVertical } from 'lucide-vue';

export default {
  name: 'BsMailingsActionsDropdown',
  components: {
    LucideMoreVertical: MoreVertical,
  },
};
</script>

<template>
  <v-menu offset-y left>
    <template #activator="{ on }">
      <v-btn
        icon
        small
        class="more-actions-btn"
        aria-label="More actions"
        v-on="on"
      >
        <lucide-more-vertical :size="18" />
      </v-btn>
    </template>
    <v-list class="actions-menu" dense>
      <slot />
    </v-list>
  </v-menu>
</template>

<style lang="scss" scoped>
.more-actions-btn {
  color: rgba(0, 0, 0, 0.54);
  transition: color 0.15s ease, background-color 0.15s ease;

  &:hover {
    color: var(--v-primary-base);
    background-color: rgba(0, 0, 0, 0.04);
  }
}

.actions-menu {
  padding: 8px 0;
  min-width: 180px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
