<template>
  <div class="bs-sidebar-context-zone">
    <!-- Email Builder context: Workspace tree (Phase 2) -->
    <bs-sidebar-workspace-tree
      v-if="activeModule === 'email-builder'"
      :collapsed="collapsed"
    />

    <!-- CRM Intelligence context: Dashboard list (Phase 4) -->
    <bs-sidebar-dashboard-list
      v-else-if="activeModule === 'crm-intelligence'"
      :collapsed="collapsed"
    />

    <!-- Settings context: Settings navigation -->
    <bs-sidebar-settings-list
      v-else-if="activeModule === 'settings'"
      :collapsed="collapsed"
    />

    <!-- Empty state when no module is active -->
    <div v-else class="bs-sidebar-context-zone__empty">
      <p v-if="!collapsed" class="text-body-2 grey--text text-center pa-4">
        {{ $t('sidebar.selectModule') }}
      </p>
    </div>
  </div>
</template>

<script>
import BsSidebarWorkspaceTree from './context/BsSidebarWorkspaceTree.vue';
import BsSidebarDashboardList from './context/BsSidebarDashboardList.vue';
import BsSidebarSettingsList from './context/BsSidebarSettingsList.vue';

export default {
  name: 'BsSidebarContextZone',
  components: {
    BsSidebarWorkspaceTree,
    BsSidebarDashboardList,
    BsSidebarSettingsList,
  },
  props: {
    activeModule: {
      type: String,
      default: null,
    },
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    activeModule: {
      immediate: true,
      handler(val) {
        console.log('[BsSidebarContextZone] activeModule prop:', val);
      },
    },
  },
};
</script>

<style scoped>
.bs-sidebar-context-zone {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.bs-sidebar-context-zone__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
}
</style>
