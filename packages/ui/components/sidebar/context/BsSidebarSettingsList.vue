<template>
  <div v-if="!collapsed" class="bs-sidebar-settings-list">
    <!-- Section header -->
    <div class="settings-list-header">
      <span class="settings-list-header__label">SETTINGS</span>
    </div>

    <!-- Settings nav items -->
    <nav class="settings-nav">
      <template v-for="category in visibleCategories">
        <div
          :key="`${category.category}-header`"
          class="settings-category-label"
        >
          {{ category.label }}
        </div>
        <nuxt-link
          v-for="item in category.items"
          :key="item.id"
          :to="item.route"
          class="settings-item"
          :class="{ 'settings-item--active': isActive(item.route) }"
        >
          <v-icon small class="settings-item__icon">
            {{ item.icon }}
          </v-icon>
          <span class="settings-item__label">{{ item.label }}</span>
        </nuxt-link>
      </template>
    </nav>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import { IS_ADMIN, IS_GROUP_ADMIN, USER, GROUP } from '~/store/user';

export default {
  name: 'BsSidebarSettingsList',
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
      group: GROUP,
    }),

    groupId() {
      return this.group?._id || this.group?.id || this.$route.params.groupId;
    },

    settingsBasePath() {
      return `/groups/${this.groupId}/settings`;
    },

    visibleCategories() {
      const canAccessGroupAdmin = this.isGroupAdmin || this.isAdmin;

      const categories = [];

      // Super Admin category
      if (this.isAdmin) {
        categories.push({
          category: 'superAdmin',
          label: this.$t('settingsNav.categories.superAdmin'),
          items: [
            {
              id: 'companies-list',
              label: this.$t('settingsNav.companiesList'),
              icon: 'mdi-domain',
              route: '/groups',
            },
          ],
        });
      }

      // General category
      const generalItems = [
        {
          id: 'general',
          label: this.$t('groups.tabs.general'),
          icon: 'mdi-cog-outline',
          route: `${this.settingsBasePath}/general`,
        },
      ];

      if (canAccessGroupAdmin) {
        generalItems.push(
          {
            id: 'workspaces',
            label: this.$tc('global.teams', 2),
            icon: 'mdi-account-group-outline',
            route: `${this.settingsBasePath}/workspaces`,
          },
          {
            id: 'integrations',
            label: this.$t('integrations.title'),
            icon: 'mdi-connection',
            route: `${this.settingsBasePath}/integrations`,
          },
          {
            id: 'ai-features',
            label: this.$t('aiFeatures.title'),
            icon: 'mdi-robot-outline',
            route: `${this.settingsBasePath}/ai-features`,
          }
        );
      }

      generalItems.push({
        id: 'users',
        label: this.$tc('global.user', 2),
        icon: 'mdi-account-outline',
        route: `${this.settingsBasePath}/users`,
      });

      categories.push({
        category: 'general',
        label: this.$t('settingsNav.categories.general'),
        items: generalItems,
      });

      // Email Builder category
      const emailBuilderItems = [];

      if (this.isAdmin) {
        emailBuilderItems.push(
          {
            id: 'export-options',
            label: this.$t('exportOptions.title'),
            icon: 'mdi-package-down',
            route: `${this.settingsBasePath}/export-options`,
          },
          {
            id: 'templates',
            label: this.$tc('global.template', 2),
            icon: 'mdi-file-document-outline',
            route: `${this.settingsBasePath}/templates`,
          },
          {
            id: 'mailings',
            label: this.$tc('global.mailing', 2),
            icon: 'mdi-email-outline',
            route: `${this.settingsBasePath}/mailings`,
          },
          {
            id: 'profiles',
            label: this.$tc('global.profile', 2),
            icon: 'mdi-send-outline',
            route: `${this.settingsBasePath}/profiles`,
          }
        );
      }

      if (canAccessGroupAdmin) {
        emailBuilderItems.push(
          {
            id: 'colors',
            label: this.$t('settingsNav.colors'),
            icon: 'mdi-palette-outline',
            route: `${this.settingsBasePath}/colors`,
          },
          {
            id: 'emails-groups',
            label: this.$tc('global.emailsGroups', 2),
            icon: 'mdi-email-multiple-outline',
            route: `${this.settingsBasePath}/emails-groups`,
          },
          {
            id: 'variables',
            label: this.$t('global.variables'),
            icon: 'mdi-code-braces',
            route: `${this.settingsBasePath}/variables`,
          }
        );
      }

      if (emailBuilderItems.length > 0) {
        categories.push({
          category: 'emailBuilder',
          label: this.$t('settingsNav.categories.emailBuilder'),
          items: emailBuilderItems,
        });
      }

      // CRM Intelligence category
      if (this.isAdmin && this.group?.enableCrmIntelligence) {
        categories.push({
          category: 'crmIntelligence',
          label: this.$t('settingsNav.categories.crmIntelligence'),
          items: [
            {
              id: 'crm-intelligence',
              label: this.$t('crmIntelligence.dashboards'),
              icon: 'mdi-chart-line',
              route: `${this.settingsBasePath}/crm-intelligence`,
            },
          ],
        });
      }

      return categories;
    },
  },
  methods: {
    isActive(route) {
      return (
        this.$route.path === route || this.$route.path.startsWith(route + '/')
      );
    },
  },
};
</script>

<style scoped>
.bs-sidebar-settings-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-list-header {
  padding: 12px 16px 8px;
  border-bottom: 1px solid #e0e0e0;
}

.settings-list-header__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
}

.settings-nav {
  overflow-y: auto;
  padding: 8px;
}

.settings-category-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #757575;
  padding: 12px 12px 6px;
}

.settings-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.87);
  transition: background-color 0.15s ease;
  margin: 1px 0;
}

.settings-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.settings-item--active {
  background-color: rgba(0, 172, 220, 0.1);
  color: var(--v-accent-base);
  font-weight: 500;
}

.settings-item__icon {
  flex-shrink: 0;
  color: inherit !important;
}

.settings-item__label {
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
