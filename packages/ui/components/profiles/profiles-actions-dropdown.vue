<script>
import { MoreVertical } from 'lucide-vue';

export default {
  name: 'ProfilesActionsDropdown',
  components: {
    LucideMoreVertical: MoreVertical,
  },
};
</script>

<template>
  <v-menu offset-y>
    <template #activator="{ on }">
      <v-btn color="accent" dark icon v-on="on">
        <lucide-more-vertical :size="18" />
      </v-btn>
    </template>
    <v-list activable>
      <slot />
    </v-list>
  </v-menu>
</template>
