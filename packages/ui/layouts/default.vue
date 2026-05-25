<script>
import { mapGetters, mapState } from 'vuex';
import { USER, IS_CONNECTED } from '~/store/user.js';
import BsSnackBar from '~/components/snackbar.vue';
import BsSidebar from '~/components/sidebar/bs-sidebar.vue';

export default {
  name: 'BsLayoutDefault',
  components: {
    BsSnackBar,
    BsSidebar,
  },
  computed: {
    ...mapGetters(USER, {
      isConnected: IS_CONNECTED,
    }),
    ...mapState('sidebar', ['collapsed', 'width', 'mobileOpen']),
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
    // Listen for toggle-mobile-menu events from child pages and update Vuex
    this.$root.$on('toggle-mobile-menu', this.handleToggleMobileSidebar);
  },
  beforeDestroy() {
    // Clean up event listener to prevent memory leaks
    this.$root.$off('toggle-mobile-menu', this.handleToggleMobileSidebar);
  },
  methods: {
    handleToggleMobileSidebar() {
      // Use Vuex mutation instead of local state
      this.$store.commit('sidebar/TOGGLE_MOBILE_OPEN');
    },
    closeMobileSidebar() {
      this.$store.commit('sidebar/SET_MOBILE_OPEN', false);
    },
  },
};
</script>

<template>
  <v-app class="fontClass app-shell">
    <!-- Mobile backdrop (only visible when sidebar is open on mobile) -->
    <v-overlay
      :value="isConnected && mobileOpen"
      :z-index="99"
      class="d-md-none"
      @click="closeMobileSidebar"
    />

    <!-- Sidebar (desktop: always visible, mobile: overlay when mobileOpen) -->
    <bs-sidebar
      v-if="isConnected"
      :class="['app-sidebar', { 'app-sidebar--mobile-open': mobileOpen }]"
    />

    <!-- Main content area -->
    <v-main class="app-main" :style="mainStyle">
      <!-- Single source of truth for page lateral margins (32px / 16px mobile).
           Children drop their own horizontal padding via the deep rules below. -->
      <div class="app-main__page">
        <!-- Each page renders its own BsPageHeader -->
        <nuxt />
      </div>
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

/* Single source of truth for page lateral margins. Page children drop their
   own horizontal padding via the deep rules below so everything aligns
   strictly at this 32px (or 16px on mobile). */
.app-main__page {
  padding-left: 32px;
  padding-right: 32px;
  padding-bottom: 32px;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 960px) {
  .app-main__page {
    padding-left: 16px;
    padding-right: 16px;
    padding-bottom: 16px;
  }
}

/* Zero out padding from common Vuetify wrappers used inside pages — both
   horizontal AND vertical. These wrappers stack their own paddings (12px on
   `.container`, 16px on `.v-card__text`) which compounds with BsPageHeader's
   margin-bottom and BsFormSection's spacing. Lateral margins live on
   `.app-main__page`; vertical rhythm comes from BsPageHeader margin-bottom
   and BsFormSection's own padding/margin.
   `!important` is needed to beat Vuetify's selectors which load later in the
   cascade. NOTE: Vuetify uses `.container` / `.container--fluid` (not
   `.v-container`). */
.app-main__page ::v-deep .container,
.app-main__page ::v-deep .container--fluid {
  padding: 0 !important;
}

.app-main__page ::v-deep .v-card__text {
  padding: 0 !important;
}

/* v-card__actions: vertical padding bumped to 16px so the save button has
   real breathing room from the divider above (Vuetify default is 8px).
   Horizontal padding stripped. */
.app-main__page ::v-deep .v-card__actions {
  padding: 16px 0 !important;
}

/* Sidebar - Desktop: always visible, Mobile: overlay when toggled */
.app-sidebar {
  /* Desktop styles applied by BsSidebar component */
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
