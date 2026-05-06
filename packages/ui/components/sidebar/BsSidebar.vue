<template>
  <aside
    class="bs-sidebar"
    :class="{
      'bs-sidebar--collapsed': collapsed && !isMobile,
    }"
    :style="sidebarStyle"
  >
    <!-- Zone 0: Brand -->
    <div class="bs-sidebar__brand-wrapper">
      <!-- Mobile close button (X icon) -->
      <button
        v-if="isMobile"
        class="bs-sidebar__mobile-close"
        aria-label="Close navigation"
        @click="handleMobileClose"
      >
        <lucide-x :size="20" />
      </button>

      <bs-sidebar-brand :collapsed="collapsed && !isMobile" />

      <!-- Toggle only on desktop -->
      <bs-sidebar-toggle
        v-if="!isMobile"
        :collapsed="collapsed"
        @toggle="handleToggle"
      />
    </div>

    <!-- Zone 1: Modules -->
    <bs-sidebar-module-list
      :modules="modules"
      :active-module="activeModule"
      :collapsed="collapsed && !isMobile"
      @select="handleModuleSelect"
    />

    <!-- Zone 2: Contextual -->
    <bs-sidebar-context-zone
      :active-module="activeModule"
      :collapsed="collapsed && !isMobile"
    />

    <!-- Zone 3: System -->
    <bs-sidebar-system-zone
      :collapsed="collapsed && !isMobile"
      @open-help="handleHelp"
    />

    <!-- Resize Handle (desktop only) -->
    <div
      v-if="!collapsed"
      class="bs-sidebar__resize-handle"
      tabindex="0"
      role="slider"
      :aria-label="$t('sidebar.resizeHandle')"
      :aria-valuemin="SIDEBAR_MIN_WIDTH"
      :aria-valuemax="SIDEBAR_MAX_WIDTH"
      :aria-valuenow="width"
      @mousedown="startResize"
      @keydown="handleResizeKeydown"
    />
  </aside>
</template>

<script>
import { mapState, mapMutations, mapGetters } from 'vuex';
import { X } from 'lucide-vue';
import BsSidebarBrand from './BsSidebarBrand.vue';
import BsSidebarModuleList from './BsSidebarModuleList.vue';
import BsSidebarContextZone from './BsSidebarContextZone.vue';
import BsSidebarSystemZone from './BsSidebarSystemZone.vue';
import BsSidebarToggle from './BsSidebarToggle.vue';
import { SIDEBAR_MODULES } from './sidebar-config.js';
import {
  SET_COLLAPSED,
  SET_ACTIVE_MODULE,
  SET_WIDTH,
  SET_LAST_GROUP_ID,
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
    LucideX: X,
  },
  data: () => ({
    isResizing: false,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH,
  }),
  computed: {
    ...mapState('sidebar', ['collapsed', 'activeModule', 'width']),
    ...mapGetters('user', {
      userGroup: 'GROUP',
      isAdmin: 'IS_ADMIN',
      isGroupAdmin: 'IS_GROUP_ADMIN',
    }),
    ...mapGetters('sidebar', ['sidebarWidth']),

    modules() {
      // Super admins administer all groups — they don't consume the modules
      // themselves and the lock indicator would be misleading. Hide the
      // module list entirely for them. Group admins and regular users keep
      // the standard subscription-based lock semantics.
      if (this.isAdmin) {
        return [];
      }
      return SIDEBAR_MODULES.map((module) => {
        const locked = module.enabledFlag
          ? !this.userGroup?.[module.enabledFlag]
          : false;
        return {
          ...module,
          locked,
        };
      });
    },

    // Detect active module from route path
    detectedModule() {
      const path = this.$route.path;
      if (path.startsWith('/mailings')) {
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

    isMobile() {
      return this.$vuetify?.breakpoint?.smAndDown || false;
    },
  },
  watch: {
    detectedModule: {
      immediate: true,
      handler(moduleId) {
        if (moduleId) {
          this.setActiveModule(moduleId);
        }
      },
    },
    '$route.params.groupId': {
      immediate: true,
      handler(groupId) {
        if (groupId) {
          this.setLastGroupId(groupId);
        }
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
      setLastGroupId: SET_LAST_GROUP_ID,
    }),

    handleToggle() {
      this.setCollapsed(!this.collapsed);
    },

    handleMobileClose() {
      // Emit event to close mobile sidebar
      this.$root.$emit('toggle-mobile-menu');
    },

    handleModuleSelect(module) {
      if (module.locked) {
        // Navigate to marketing page for locked modules
        this.$router.push(`/module-unavailable/${module.id}`);
      } else {
        this.$router.push(module.route);
      }
    },

    handleHelp() {
      const helpUrl = process.env.HELP_URL || 'https://docs.lepatron.email';
      try {
        const newWindow = window.open(helpUrl, '_blank');
        if (!newWindow) {
          // Popup blocked - fallback to same window
          console.warn('[BsSidebar] Popup blocked, opening in same window');
          window.location.href = helpUrl;
        }
      } catch (error) {
        console.error('[BsSidebar] Failed to open help URL:', error);
        // Fallback: try to navigate in the same window
        window.location.href = helpUrl;
      }
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

    handleResizeKeydown(e) {
      const SMALL_STEP = 10;
      const LARGE_STEP = 50;
      let newWidth = this.width;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newWidth = this.width - (e.shiftKey ? LARGE_STEP : SMALL_STEP);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newWidth = this.width + (e.shiftKey ? LARGE_STEP : SMALL_STEP);
          break;
        case 'Home':
          e.preventDefault();
          newWidth = SIDEBAR_MIN_WIDTH;
          break;
        case 'End':
          e.preventDefault();
          newWidth = SIDEBAR_MAX_WIDTH;
          break;
        default:
          return; // Don't handle other keys
      }

      // Clamp value within min/max bounds
      if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= SIDEBAR_MAX_WIDTH) {
        this.setWidth(newWidth);
      }
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

.bs-sidebar__mobile-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--gray-700);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--t-fast), color var(--t-fast);
  z-index: 10;
}

.bs-sidebar__mobile-close:hover {
  background: var(--gray-100);
  color: var(--gray-900);
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
  z-index: 5;
}

.bs-sidebar__resize-handle:hover {
  background-color: rgba(0, 172, 220, 0.3);
}

.bs-sidebar__resize-handle:active {
  background-color: rgba(0, 172, 220, 0.5);
}

/* Mobile: hide resize handle */
@media (max-width: 960px) {
  .bs-sidebar__resize-handle {
    display: none;
  }
}
</style>
