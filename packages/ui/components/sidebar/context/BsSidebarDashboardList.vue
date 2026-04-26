<template>
  <div v-if="!collapsed" class="bs-sidebar-dashboard-list">
    <!-- Section header -->
    <div class="dashboard-list-header">
      <span class="dashboard-list-header__label">DASHBOARDS</span>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state pa-4">
      <v-skeleton-loader
        v-for="i in 3"
        :key="i"
        type="list-item"
        class="mb-2"
      />
    </div>

    <!-- Dashboard list -->
    <nav v-else-if="dashboards.length > 0" class="dashboard-nav">
      <nuxt-link
        v-for="dashboard in dashboards"
        :key="dashboard.id"
        :to="`/crm-intelligence?dashboardId=${dashboard.id}`"
        class="dashboard-item"
        :class="{ 'dashboard-item--active': isActive(dashboard.id) }"
      >
        <lucide-bar-chart :size="16" />
        <span class="dashboard-name">{{ dashboard.name }}</span>
      </nuxt-link>
    </nav>

    <!-- Empty state -->
    <div v-else class="empty-state pa-4">
      <p class="text-body-2 grey--text text-center mb-0">
        {{ $t('crmIntelligence.noDashboards') }}
      </p>
    </div>
  </div>
</template>

<script>
import { BarChart } from 'lucide-vue';
import { getCrmIntelligenceDashboards } from '~/helpers/api-routes.js';

export default {
  name: 'BsSidebarDashboardList',
  components: {
    LucideBarChart: BarChart,
  },
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    dashboards: [],
    loading: true,
  }),
  async mounted() {
    await this.fetchDashboards();
  },
  methods: {
    async fetchDashboards() {
      try {
        this.loading = true;
        const response = await this.$axios.$get(getCrmIntelligenceDashboards());
        this.dashboards = response || [];
      } catch (err) {
        console.error(
          '[BsSidebarDashboardList] Failed to fetch dashboards:',
          err
        );
        this.dashboards = [];
      } finally {
        this.loading = false;
      }
    },

    isActive(dashboardId) {
      return this.$route.query.dashboardId === dashboardId;
    },
  },
};
</script>

<style scoped>
.bs-sidebar-dashboard-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dashboard-list-header {
  padding: 12px 16px 8px;
  border-bottom: 1px solid #e0e0e0;
}

.dashboard-list-header__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
}

.dashboard-nav {
  overflow-y: auto;
  padding: 4px 8px;
}

.dashboard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.87);
  transition: background-color 0.15s ease;
  margin: 1px 0;
}

.dashboard-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dashboard-item--active {
  background-color: rgba(0, 172, 220, 0.1);
  color: var(--v-accent-base);
  font-weight: 500;
}

.dashboard-name {
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-state {
  flex: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
