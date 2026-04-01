<script>
import { LineChart } from 'lucide-vue';

export default {
  name: 'DashboardList',
  components: {
    LucideLineChart: LineChart,
  },
  props: {
    dashboards: {
      type: Array,
      required: true,
    },
    selected: {
      type: Object,
      default: null,
    },
  },
  computed: {
    sortedDashboards() {
      return [...this.dashboards].sort((a, b) => (a.order || 0) - (b.order || 0));
    },
  },
  methods: {
    isSelected(dashboard) {
      return this.selected?.id === dashboard.id;
    },
    selectDashboard(dashboard) {
      this.$emit('select', dashboard);
    },
  },
};
</script>

<template>
  <div>
    <v-list nav dense class="pt-2">
      <v-subheader>{{ $t('crmIntelligence.dashboards') }}</v-subheader>

      <v-list-item-group :value="selected" color="accent">
        <v-list-item
          v-for="dashboard in sortedDashboards"
          :key="dashboard.id"
          :input-value="isSelected(dashboard)"
          :class="{ 'dashboard-item--selected': isSelected(dashboard) }"
          @click="selectDashboard(dashboard)"
        >
          <v-list-item-icon>
            <lucide-line-chart :size="20" :style="{ color: isSelected(dashboard) ? 'var(--v-accent-base)' : '' }" />
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ dashboard.name }}</v-list-item-title>
            <v-list-item-subtitle v-if="dashboard.description">
              {{ dashboard.description }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list-item-group>

      <v-list-item v-if="dashboards.length === 0" disabled>
        <v-list-item-content>
          <v-list-item-title class="text--disabled">
            {{ $t('crmIntelligence.noDashboards') }}
          </v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </div>
</template>

<style scoped>
.dashboard-item--selected {
  background-color: rgba(0, 172, 220, 0.12) !important;
  border-left: 3px solid #00acdc;
}
</style>
