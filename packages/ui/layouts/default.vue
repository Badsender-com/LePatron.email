<script>
import { mapGetters } from 'vuex';
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
      mobileDrawerOpen: false,
    };
  },
  computed: {
    ...mapGetters(USER, {
      isConnected: IS_CONNECTED,
    }),
    mainStyle() {
      if (!this.isConnected) return {};

      // On mobile, main takes full width (sidebar is drawer)
      if (this.$vuetify?.breakpoint?.mobile) {
        return {};
      }

      // On desktop, main adapts to sidebar width
      const sidebarWidth = this.$store.getters['sidebar/sidebarWidth'] || 320;
      return {
        marginLeft: `${sidebarWidth}px`,
        transition: 'margin-left 200ms ease',
      };
    },
  },
  watch: {
    $route() {
      // Auto-close mobile drawer on route change
      this.closeMobileDrawer();
    },
  },
  methods: {
    toggleMobileDrawer() {
      this.mobileDrawerOpen = !this.mobileDrawerOpen;
    },
    closeMobileDrawer() {
      this.mobileDrawerOpen = false;
    },
  },
};
</script>

<template>
  <v-app class="fontClass app-shell">
    <!-- Desktop: Fixed sidebar, Mobile: Hidden (drawer mode) -->
    <bs-sidebar
      v-if="isConnected"
      v-model="mobileDrawerOpen"
      class="d-none d-md-flex"
    />

    <!-- Mobile: Temporary drawer -->
    <v-navigation-drawer
      v-if="isConnected"
      v-model="mobileDrawerOpen"
      temporary
      app
      width="280"
      class="d-md-none mobile-drawer"
    >
      <!-- Render sidebar content in mobile drawer -->
      <bs-sidebar :is-mobile-drawer="true" />
    </v-navigation-drawer>

    <!-- Main content area -->
    <v-main class="app-main" :style="mainStyle">
      <!-- Each page renders its own BsPageHeader -->
      <nuxt @toggle-mobile-menu="toggleMobileDrawer" />
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

/* Mobile drawer styling */
.mobile-drawer >>> .bs-sidebar {
  width: 100%;
  position: static;
}
</style>
