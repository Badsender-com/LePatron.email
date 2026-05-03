<script>
import { mapGetters, mapState } from 'vuex';
import { USER, IS_CONNECTED } from '~/store/user.js';
import BsSnackBar from '~/components/snackbar.vue';
import BsSidebar from '~/components/sidebar/BsSidebar.vue';

export default {
  name: 'BsLayoutDefault',
  components: {
    BsSnackBar,
    BsSidebar,
  },
  data() {
    return {
      mobileOpen: false,
    };
  },
  computed: {
    ...mapGetters(USER, {
      isConnected: IS_CONNECTED,
    }),
    ...mapState('sidebar', ['collapsed', 'width']),
    mainStyle() {
      if (!this.isConnected) return {};

      // On mobile (< 960px), main takes full width (sidebar is overlay)
      // Use mdAndUp to match the d-md-flex breakpoint (960px)
      const isDesktop = this.$vuetify?.breakpoint?.mdAndUp;
      if (!isDesktop) {
        return {};
      }

      // On desktop (>= 960px), main adapts to sidebar width
      // Use collapsed and width directly to ensure reactivity
      const COLLAPSED_WIDTH = 60;
      const effectiveWidth = this.collapsed
        ? COLLAPSED_WIDTH
        : this.width || 320;

      return {
        marginLeft: `${effectiveWidth}px`,
        transition: 'margin-left 200ms ease',
      };
    },
  },
  watch: {
    $route() {
      // Auto-close mobile sidebar on route change
      this.closeMobileSidebar();
    },
  },
  mounted() {
    // Listen for toggle-mobile-menu events from child pages
    this.$root.$on('toggle-mobile-menu', this.toggleMobileSidebar);
  },
  beforeDestroy() {
    // Clean up event listener
    this.$root.$off('toggle-mobile-menu', this.toggleMobileSidebar);
  },
  methods: {
    toggleMobileSidebar() {
      this.mobileOpen = !this.mobileOpen;
    },
    closeMobileSidebar() {
      this.mobileOpen = false;
    },
  },
};
</script>

<template>
  <v-app class="fontClass app-shell">
    <!-- Mobile backdrop (only visible when sidebar is open on mobile) -->
    <div
      v-if="isConnected && mobileOpen"
      class="mobile-backdrop d-md-none"
      @click="closeMobileSidebar"
    />

    <!-- Sidebar (desktop: always visible, mobile: overlay when mobileOpen) -->
    <bs-sidebar
      v-if="isConnected"
      :class="['app-sidebar', { 'app-sidebar--mobile-open': mobileOpen }]"
    />

    <!-- Main content area -->
    <v-main class="app-main" :style="mainStyle">
      <!-- Each page renders its own BsPageHeader -->
      <nuxt />
    </v-main>

    <bs-snack-bar />
  </v-app>
</template>

<style scoped>
/* =========================================================================
   Global layout without topbar
   Spec: /tmp/lepatron-design-v3/preview/layout-without-topbar.html
   ========================================================================= */

.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  min-width: 0; /* lets BsPageHeader truncate titles */
  display: flex;
  flex-direction: column;
  overflow: auto; /* scroll lives here, not on body */
}

/* Sidebar - Desktop: always visible, Mobile: overlay when toggled */
.app-sidebar {
  /* Desktop styles applied by BsSidebar component */
}

/* Mobile backdrop */
.mobile-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99; /* Below sidebar (z-index: 100) */
  animation: fadeIn 200ms ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Mobile sidebar behavior */
@media (max-width: 960px) {
  .app-sidebar {
    transform: translateX(-100%);
    transition: transform 250ms ease;
    z-index: 100;
  }

  .app-sidebar--mobile-open {
    transform: translateX(0);
  }
}
</style>
