<script>
import { mapGetters } from 'vuex';
import { USER, IS_ADMIN, IS_GROUP_ADMIN, IS_CONNECTED } from '~/store/user.js';
import { getCrmIntelligenceStatus } from '~/helpers/api-routes.js';

export default {
  name: 'BsModuleRail',
  data() {
    return {
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
      // For admins, always show as active (they configure via /groups)
      if (this.isAdmin) return true;
      return this.crmIntelligenceEnabled;
    },
    crmIntelligenceTooltip() {
      if (this.isAdmin) {
        return this.$t('modules.crmIntelligence');
      }
      if (!this.crmIntelligenceEnabled) {
        return `${this.$t('modules.crmIntelligence')} - ${this.$t('modules.inactive')}`;
      }
      return this.$t('modules.crmIntelligence');
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
  <v-navigation-drawer
    v-if="isConnected"
    permanent
    mini-variant
    :mini-variant-width="56"
    app
    class="module-rail"
  >
    <v-list dense nav class="py-2">
      <!-- Email Builder - Always active -->
      <v-tooltip right>
        <template #activator="{ on, attrs }">
          <v-list-item
            nuxt
            :to="emailBuilderRoute"
            :class="{ 'v-list-item--active': isEmailModule }"
            v-bind="attrs"
            v-on="on"
          >
            <v-list-item-icon class="mx-auto">
              <v-icon>mdi-email-outline</v-icon>
            </v-list-item-icon>
          </v-list-item>
        </template>
        <span>{{ $t('modules.emailBuilder') }}</span>
      </v-tooltip>

      <!-- CRM Intelligence - Always visible, with inactive state -->
      <v-tooltip right>
        <template #activator="{ on, attrs }">
          <v-list-item
            nuxt
            to="/crm-intelligence"
            :class="{
              'v-list-item--active': isCrmModule,
              'module-inactive': !isCrmIntelligenceActive,
            }"
            v-bind="attrs"
            v-on="on"
          >
            <v-list-item-icon class="mx-auto">
              <v-badge
                v-if="!isCrmIntelligenceActive && crmIntelligenceLoaded"
                dot
                color="grey"
                offset-x="8"
                offset-y="8"
              >
                <v-icon>mdi-chart-areaspline</v-icon>
              </v-badge>
              <v-icon v-else>mdi-chart-areaspline</v-icon>
            </v-list-item-icon>
          </v-list-item>
        </template>
        <span>{{ crmIntelligenceTooltip }}</span>
      </v-tooltip>
    </v-list>

    <template #append>
      <v-list dense nav class="py-2">
        <!-- Settings - Always visible for all users -->
        <v-tooltip right>
          <template #activator="{ on, attrs }">
            <v-list-item
              nuxt
              :to="settingsRoute"
              :class="{ 'v-list-item--active': isSettingsModule }"
              v-bind="attrs"
              v-on="on"
            >
              <v-list-item-icon class="mx-auto">
                <v-icon>mdi-cog-outline</v-icon>
              </v-list-item-icon>
            </v-list-item>
          </template>
          <span>{{ $t('modules.settings') }}</span>
        </v-tooltip>
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
.module-rail {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  z-index: 4;
}

.module-rail .v-list-item {
  min-height: 48px;
  margin-bottom: 4px;
}

.module-rail .v-list-item--active {
  background-color: rgba(var(--v-primary-base), 0.12);
}

.module-rail .v-list-item--active .v-icon {
  color: var(--v-primary-base);
}

/* Inactive module styling */
.module-rail .module-inactive .v-icon {
  opacity: 0.4;
}

.module-rail .module-inactive:hover .v-icon {
  opacity: 0.6;
}
</style>
