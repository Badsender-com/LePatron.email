<template>
  <aside
    class="bs-sidebar"
    :class="{
      'bs-sidebar--collapsed': collapsed && !isMobileDrawer,
      'bs-sidebar--mobile': isMobileDrawer,
    }"
    :style="!isMobileDrawer ? sidebarStyle : {}"
  >
    <!-- Zone 0: Brand -->
    <div class="bs-sidebar__brand-wrapper">
      <bs-sidebar-brand :collapsed="collapsed && !isMobileDrawer" />
      <!-- Toggle only on desktop -->
      <bs-sidebar-toggle
        v-if="!isMobileDrawer"
        :collapsed="collapsed"
        @toggle="handleToggle"
      />
    </div>

    <!-- Zone 1: Modules -->
    <bs-sidebar-module-list
      :modules="modules"
      :active-module="activeModule"
      :collapsed="collapsed && !isMobileDrawer"
      @select="handleModuleSelect"
    />

    <!-- Zone 2: Contextual -->
    <bs-sidebar-context-zone
      :active-module="activeModule"
      :collapsed="collapsed && !isMobileDrawer"
    />

    <!-- Zone 3: System -->
    <bs-sidebar-system-zone
      :collapsed="collapsed && !isMobileDrawer"
      @open-help="handleHelp"
    />

    <!-- Resize Handle (desktop only) -->
    <div
      v-if="!collapsed && !isMobileDrawer"
      class="bs-sidebar__resize-handle"
      @mousedown="startResize"
    />

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
import {
  SET_COLLAPSED,
  SET_ACTIVE_MODULE,
  SET_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from '~/store/sidebar';

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
  props: {
    // When true, sidebar is rendered inside mobile drawer (no resize handle, no toggle)
    isMobileDrawer: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    showUpgradeModal: false,
    selectedModule: null,
    isResizing: false,
  }),
  computed: {
    ...mapState('sidebar', ['collapsed', 'activeModule', 'width']),
    ...mapGetters('user', {
      userGroup: 'GROUP',
    }),
    ...mapGetters('sidebar', ['sidebarWidth']),

    modules() {
      return SIDEBAR_MODULES.map((module) => ({
        ...module,
        locked: module.enabledFlag
          ? !this.userGroup?.[module.enabledFlag]
          : false,
      }));
    },

    // Detect active module from route path
    detectedModule() {
      const path = this.$route.path;
      if (path.startsWith('/mailings') || path.startsWith('/templates')) {
        return 'email-builder';
      }
      if (path.startsWith('/crm-intelligence')) {
        return 'crm-intelligence';
      }
      if (path.includes('/settings')) {
        return 'settings';
      }
      return null;
    },

    sidebarStyle() {
      return {
        width: `${this.sidebarWidth}px`,
      };
    },
  },
  watch: {
    detectedModule: {
      immediate: true,
      handler(moduleId) {
        console.log('[BsSidebar] Detected module from path:', moduleId);
        if (moduleId) {
          this.setActiveModule(moduleId);
        }
      },
    },
    activeModule: {
      immediate: true,
      handler(val) {
        console.log('[BsSidebar] activeModule changed:', val);
      },
    },
  },
  mounted() {
    // Add event listeners for resize
    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.stopResize);
  },
  beforeDestroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
  },
  methods: {
    ...mapMutations('sidebar', {
      setCollapsed: SET_COLLAPSED,
      setActiveModule: SET_ACTIVE_MODULE,
      setWidth: SET_WIDTH,
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

    startResize(e) {
      this.isResizing = true;
      e.preventDefault();
    },

    handleResize(e) {
      if (!this.isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= SIDEBAR_MAX_WIDTH) {
        this.setWidth(newWidth);
      }
    },

    stopResize() {
      this.isResizing = false;
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
  background: #ffffff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  z-index: 100;
  user-select: none;
}

.bs-sidebar--collapsed {
  width: 60px !important;
}

.bs-sidebar__brand-wrapper {
  position: relative;
}

.bs-sidebar__resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  background: transparent;
  transition: background-color 150ms ease;
  z-index: 101;
}

.bs-sidebar__resize-handle:hover {
  background-color: rgba(0, 172, 220, 0.3);
}

.bs-sidebar__resize-handle:active {
  background-color: rgba(0, 172, 220, 0.5);
}

@media (max-width: 960px) {
  .bs-sidebar {
    display: none;
  }
}
</style>
