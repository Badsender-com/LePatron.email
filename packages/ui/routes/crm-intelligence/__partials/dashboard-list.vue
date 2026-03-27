<script>
export default {
  name: 'DashboardList',
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

      <v-list-item-group :value="selected" color="primary">
        <v-list-item
          v-for="dashboard in sortedDashboards"
          :key="dashboard.id"
          :input-value="isSelected(dashboard)"
          @click="selectDashboard(dashboard)"
        >
          <v-list-item-icon>
            <v-icon>mdi-chart-box</v-icon>
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
