<script>
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import { Archive, FlaskConical } from 'lucide-vue';

export default {
  name: 'BsAiDetailHeader',
  components: {
    BsPageHeader,
    LucideArchive: Archive,
    LucideFlask: FlaskConical,
  },
  props: {
    title: { type: String, required: true },
    status: { type: String, required: true },
    backTo: { type: String, required: true },
    // Optional "Test in the playground" link (skill pages only). The route
    // lives on the playground branch; harmless until the branches are merged.
    playgroundTo: { type: String, default: null },
  },
  computed: {
    statusColor() {
      return (
        { ACTIVE: 'success', DRAFT: 'warning', ARCHIVED: 'grey' }[
          this.status
        ] || 'grey'
      );
    },
    statusLabel() {
      return this.$t(`aiSkills.statuses.${this.status}`);
    },
  },
};
</script>

<template>
  <bs-page-header
    :back="{ to: backTo }"
    :show-mobile-menu="true"
    @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
  >
    <template #title>
      {{ title }}
    </template>
    <template #badge>
      <v-chip
        small
        :color="statusColor"
        :outlined="status !== 'ACTIVE'"
        :dark="status === 'ACTIVE'"
      >
        {{ statusLabel }}
      </v-chip>
    </template>
    <template #actions>
      <v-btn v-if="playgroundTo" text color="primary" :to="playgroundTo">
        <lucide-flask :size="18" class="mr-2" />
        {{ $t('aiSkills.skill.testInPlayground') }}
      </v-btn>
      <v-btn
        v-if="status !== 'ARCHIVED'"
        outlined
        color="error"
        @click="$emit('archive')"
      >
        <lucide-archive :size="18" class="mr-2" />
        {{ $t('aiSkills.actions.archive') }}
      </v-btn>
    </template>
  </bs-page-header>
</template>
