<template>
  <inventory-step-generic
    :audit-id="auditId"
    :items="items"
    category="platform"
    title="Sending Platforms"
    description="List all Email Service Providers (ESP) you use to send emails"
    placeholder="e.g., Brevo, Actito, Adobe Campaign"
    @save="$emit('save', $event)"
    @next="$emit('next')"
  />
</template>

<script>
import InventoryStepGeneric from './inventory-step-generic.vue';

export default {
  name: 'InventoryStepPlatforms',
  components: {
    InventoryStepGeneric,
  },
  props: {
    auditId: {
      type: String,
      required: true,
    },
    items: {
      type: Array,
      default: () => [],
    },
  },
};
</script>
