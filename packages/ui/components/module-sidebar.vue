<script>
import { mapGetters } from 'vuex';
import { USER, IS_ADMIN, IS_GROUP_ADMIN, IS_CONNECTED } from '~/store/user.js';
import { getCrmIntelligenceStatus } from '~/helpers/api-routes.js';
import BsSidebarItem from '~/components/sidebar-item.vue';

export default {
  name: 'BsModuleSidebar',
  components: { BsSidebarItem },
  data() {
    return {
      isHovered: false,
      crmIntelligenceEnabled: false,
      crmIntelligenceLoaded: false,
    };
  },
  async fetch() {
    // Check if CRM Intelligence is available for this user
    if (!this.isAdmin) {
      try {
        const status = await this.$axios.$get(getCrmIntelligenceStatus());
        this.crmIntelligenceEnabled = status.enabled;
      } catch (err) {
        // Silent fail - module will show as inactive
      }
    }
    this.crmIntelligenceLoaded = true;
  },
  computed: {
    ...mapGetters(USER, {
      isConnected: IS_CONNECTED,
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    emailBuilderRoute() {
      return '/mailings';
    },
    settingsRoute() {
      if (this.isAdmin) {
        return '/groups';
      }
      const groupId = this.$store.state.user?.info?.group?.id;
      return groupId ? `/groups/${groupId}` : '/mailings';
    },
    isCrmIntelligenceActive() {
      if (this.isAdmin) return true;
      return this.crmIntelligenceEnabled;
    },
    isEmailModule() {
      const path = this.$route.path;
      return (
        path.startsWith('/mailings') ||
        path.startsWith('/templates') ||
        path.startsWith('/editor')
      );
    },
    isCrmModule() {
      return this.$route.path.startsWith('/crm-intelligence');
    },
    isSettingsModule() {
      const path = this.$route.path;
      return (
        path.startsWith('/groups') ||
        path.startsWith('/users') ||
        path.startsWith('/settings')
      );
    },
  },
};
</script>

<template>
  <nav
    v-if="isConnected"
    class="module-sidebar"
    :class="{ 'module-sidebar--expanded': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- MODULES -->
    <div class="sidebar-section">
      <bs-sidebar-item
        :to="emailBuilderRoute"
        icon="mdi-palette"
        :label="$t('modules.emailBuilder')"
        :active="isEmailModule"
        :expanded="isHovered"
      />
      <bs-sidebar-item
        to="/crm-intelligence"
        icon="mdi-chart-line"
        :label="$t('modules.crmIntelligence')"
        :active="isCrmModule"
        :disabled="!isCrmIntelligenceActive"
        :expanded="isHovered"
      />
    </div>

    <div class="sidebar-spacer" />

    <div class="sidebar-divider" />

    <!-- UTILITIES -->
    <div class="sidebar-section">
      <bs-sidebar-item
        icon="mdi-help-circle-outline"
        :label="$t('sidebar.help')"
        href="https://www.lepatron.email/faq/"
        target="_blank"
        :expanded="isHovered"
      />
      <bs-sidebar-item
        icon="mdi-logout"
        :label="$t('sidebar.logout')"
        href="/account/logout"
        :expanded="isHovered"
      />
    </div>

    <div class="sidebar-divider" />

    <!-- SETTINGS -->
    <div class="sidebar-section">
      <bs-sidebar-item
        :to="settingsRoute"
        icon="mdi-cog-outline"
        :label="$t('modules.settings')"
        :active="isSettingsModule"
        :expanded="isHovered"
      />
    </div>
  </nav>
</template>

<style scoped>
.module-sidebar {
  position: fixed;
  top: 64px;
  left: 0;
  bottom: 0;
  width: 56px;
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  z-index: 5;
  display: flex;
  flex-direction: column;
  transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.module-sidebar--expanded {
  width: 220px;
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
}

.sidebar-section {
  padding: 8px 0;
}

.sidebar-spacer {
  flex: 1;
}

.sidebar-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.12);
  margin: 0 12px;
}

@media (max-width: 960px) {
  .module-sidebar {
    display: none !important;
  }
}
</style>
