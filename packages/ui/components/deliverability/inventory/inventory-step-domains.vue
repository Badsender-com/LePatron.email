<template>
  <inventory-step-generic
    :audit-id="auditId"
    :items="items"
    :category="category"
    :title="title"
    :description="description"
    placeholder="e.g., company.com, newsletter.company.com"
    @save="$emit('save', $event)"
    @prev="$emit('prev')"
    @next="$emit('next')"
  />
</template>

<script>
import InventoryStepGeneric from './inventory-step-generic.vue';

export default {
  name: 'InventoryStepDomains',
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
    category: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
};
</script>
