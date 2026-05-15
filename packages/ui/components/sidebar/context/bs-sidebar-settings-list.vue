<template>
  <div v-if="!collapsed" class="bs-sidebar-settings-list">
    <!-- Section header -->
    <div class="settings-list-header">
      <span class="settings-list-header__label">{{
        $t('sidebar.settingsHeader')
      }}</span>
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
          :class="{ 'settings-item--active': isActive(item) }"
        >
          <v-icon small class="settings-item__icon">
            {{ item.icon }}
          </v-icon>
          <span class="settings-item__label">{{ item.label }}</span>
          <v-tooltip v-if="item.superAdminOnly" right>
            <template #activator="{ on, attrs }">
              <span class="settings-item__super-admin" v-bind="attrs" v-on="on">
                <lucide-shield :size="14" />
              </span>
            </template>
            <span>{{ $t('settingsNav.superAdminOnly') }}</span>
          </v-tooltip>
        </nuxt-link>
      </template>
    </nav>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import { IS_ADMIN, IS_GROUP_ADMIN, USER, GROUP } from '~/store/user';
import { Shield } from 'lucide-vue';
import { isFlagEnabled } from '~/helpers/module-activation';

export default {
  name: 'BsSidebarSettingsList',
  components: {
    LucideShield: Shield,
  },
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
    ...mapGetters('sidebar', {
      lastGroupId: 'lastGroupId',
    }),

    groupId() {
      return (
        this.$route.params.groupId ||
        this.lastGroupId ||
        this.group?._id ||
        this.group?.id ||
        null
      );
    },

    settingsBasePath() {
      return this.groupId ? `/groups/${this.groupId}/settings` : null;
    },

    visibleCategories() {
      const canAccessGroupAdmin = this.isGroupAdmin || this.isAdmin;
      const hasGroupContext = !!this.settingsBasePath;

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
              // Exact match: don't highlight when navigating into a specific group
              exact: true,
              superAdminOnly: true,
            },
          ],
        });
      }

      // Group-scoped categories (general / email builder / crm intelligence)
      // require a resolvable groupId; without it any link would point to
      // /groups/undefined/... and trigger a backend ObjectId cast error.
      if (!hasGroupContext) {
        return categories;
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
            activePatterns: [
              `${this.settingsBasePath}/workspaces`,
              `/groups/${this.groupId}/workspace`,
              `/groups/${this.groupId}/new-workspace`,
            ],
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
        activePatterns: [
          `${this.settingsBasePath}/users`,
          `/groups/${this.groupId}/new-user`,
        ],
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
            superAdminOnly: true,
          },
          {
            id: 'templates',
            label: this.$tc('global.template', 2),
            icon: 'mdi-file-document-outline',
            route: `${this.settingsBasePath}/templates`,
            superAdminOnly: true,
            activePatterns: [
              `${this.settingsBasePath}/templates`,
              `/groups/${this.groupId}/new-template`,
              '/templates',
            ],
          },
          {
            id: 'mailings',
            label: this.$tc('global.mailing', 2),
            icon: 'mdi-email-outline',
            route: `${this.settingsBasePath}/mailings`,
            superAdminOnly: true,
          },
          {
            id: 'profiles',
            label: this.$tc('global.profile', 2),
            icon: 'mdi-send-outline',
            route: `${this.settingsBasePath}/profiles`,
            superAdminOnly: true,
            activePatterns: [
              `${this.settingsBasePath}/profiles`,
              `/groups/${this.groupId}/profiles`,
              `/groups/${this.groupId}/new-profile`,
            ],
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
            activePatterns: [
              `${this.settingsBasePath}/emails-groups`,
              `/groups/${this.groupId}/emails-groups`,
              `/groups/${this.groupId}/new-emails-group`,
            ],
          },
          {
            id: 'variables',
            label: this.$t('global.variables'),
            icon: 'mdi-code-braces',
            route: `${this.settingsBasePath}/variables`,
          }
        );
      }

      // Email Builder category - visible if:
      // - Super admin: always visible
      // - Group admin: only if module enabled
      const showEmailBuilder = isFlagEnabled(
        'enableEmailBuilder',
        { isAdmin: this.isAdmin },
        this.group
      );

      if (emailBuilderItems.length > 0 && showEmailBuilder) {
        categories.push({
          category: 'emailBuilder',
          label: this.$t('settingsNav.categories.emailBuilder'),
          items: emailBuilderItems,
        });
      }

      // CRM Intelligence category - visible only for super admin
      if (this.isAdmin) {
        categories.push({
          category: 'crmIntelligence',
          label: this.$t('settingsNav.categories.crmIntelligence'),
          items: [
            {
              id: 'crm-intelligence',
              label: this.$t('crmIntelligence.dashboards'),
              icon: 'mdi-chart-line',
              route: `${this.settingsBasePath}/crm-intelligence`,
              superAdminOnly: true,
            },
          ],
        });
      }

      return categories;
    },
  },
  methods: {
    isActive(item) {
      const path = this.$route.path;

      if (item.exact) {
        return path === item.route;
      }

      const patterns = item.activePatterns || [item.route];
      return patterns.some((p) => path === p || path.startsWith(p + '/'));
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

/* Right-aligned shield indicator on super-admin-only entries — matches the
   legacy BsGroupSettingsNav indicator. */
.settings-item__super-admin {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--v-accent-base);
}

.settings-item--active .settings-item__super-admin {
  color: var(--v-accent-base);
}
</style>
