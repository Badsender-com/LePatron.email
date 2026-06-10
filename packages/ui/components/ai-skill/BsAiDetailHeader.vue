<script>
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import { Archive } from 'lucide-vue';

export default {
  name: 'BsAiDetailHeader',
  components: { BsPageHeader, LucideArchive: Archive },
  props: {
    title: { type: String, required: true },
    status: { type: String, required: true },
    backTo: { type: String, required: true },
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
