<template>
  <aside class="bs-sidebar" :class="{ 'bs-sidebar--collapsed': collapsed }">
    <!-- Zone 0: Brand -->
    <div class="bs-sidebar__brand-wrapper">
      <bs-sidebar-brand :collapsed="collapsed" />
      <bs-sidebar-toggle :collapsed="collapsed" @toggle="handleToggle" />
    </div>

    <!-- Zone 1: Modules -->
    <bs-sidebar-module-list
      :modules="modules"
      :active-module="activeModule"
      :collapsed="collapsed"
      @select="handleModuleSelect"
    />

    <!-- Zone 2: Contextual -->
    <bs-sidebar-context-zone
      :active-module="activeModule"
      :collapsed="collapsed"
    />

    <!-- Zone 3: System -->
    <bs-sidebar-system-zone :collapsed="collapsed" @open-help="handleHelp" />

    <!-- Upgrade Modal -->
    <bs-upgrade-modal v-model="showUpgradeModal" :module="selectedModule" />
  </aside>
</template>

<script>
import { mapState, mapMutations, mapGetters } from 'vuex';
import BsSidebarBrand from './BsSidebarBrand.vue';
import BsSidebarModuleList from './BsSidebarModuleList.vue';
import BsSidebarContextZone from './BsSidebarContextZone.vue';
import BsSidebarSystemZone from './BsSidebarSystemZone.vue';
import BsSidebarToggle from './BsSidebarToggle.vue';
import BsUpgradeModal from './BsUpgradeModal.vue';
import { SIDEBAR_MODULES } from './sidebar-config.js';
import { SET_COLLAPSED, SET_ACTIVE_MODULE } from '~/store/sidebar';

export default {
  name: 'BsSidebar',
  components: {
    BsSidebarBrand,
    BsSidebarModuleList,
    BsSidebarContextZone,
    BsSidebarSystemZone,
    BsSidebarToggle,
    BsUpgradeModal,
  },
  data: () => ({
    showUpgradeModal: false,
    selectedModule: null,
  }),
  computed: {
    ...mapState('sidebar', ['collapsed', 'activeModule']),
    ...mapGetters('user', {
      userGroup: 'group',
    }),

    modules() {
      return SIDEBAR_MODULES.map((module) => ({
        ...module,
        locked: module.enabledFlag && !this.userGroup?.[module.enabledFlag],
      }));
    },
  },
  watch: {
    '$route.meta.sidebarModule': {
      immediate: true,
      handler(moduleId) {
        if (moduleId) {
          this.setActiveModule(moduleId);
        }
      },
    },
  },
  methods: {
    ...mapMutations('sidebar', {
      setCollapsed: SET_COLLAPSED,
      setActiveModule: SET_ACTIVE_MODULE,
    }),

    handleToggle() {
      this.setCollapsed(!this.collapsed);
    },

    handleModuleSelect(module) {
      if (module.locked) {
        this.selectedModule = module;
        this.showUpgradeModal = true;
      } else {
        this.$router.push(module.route);
      }
    },

    handleHelp() {
      // TODO: Implement help modal or redirect to documentation
      window.open('https://docs.lepatron.email', '_blank');
    },
  },
};
</script>

<style scoped>
.bs-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 240px;
  background: #ffffff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  transition: width 200ms ease;
  z-index: 100;
}

.bs-sidebar--collapsed {
  width: 60px;
}

.bs-sidebar__brand-wrapper {
  position: relative;
}

@media (max-width: 960px) {
  .bs-sidebar {
    display: none;
  }
}
</style>
