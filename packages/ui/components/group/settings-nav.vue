<script>
import { mapGetters } from 'vuex';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '../../store/user';
import { ArrowLeft, Shield } from 'lucide-vue';

export default {
  name: 'BsGroupSettingsNav',
  components: {
    LucideArrowLeft: ArrowLeft,
    LucideShield: Shield,
  },
  props: {
    group: {
      type: Object,
      default: () => ({}),
    },
    currentRoute: {
      type: String,
      default: '',
    },
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    groupId() {
      return this.group?.id || this.$route.params.groupId;
    },
    settingsBasePath() {
      return `/groups/${this.groupId}/settings`;
    },
    navItems() {
      // Super admin (isAdmin) has access to all features
      // Group admin (isGroupAdmin) has access to group-level features only
      const canAccessGroupAdmin = this.isGroupAdmin || this.isAdmin;

      const items = [];

      // Super Admin category - only for super admin
      if (this.isAdmin) {
        items.push({
          category: 'superAdmin',
          label: this.$t('settingsNav.categories.superAdmin'),
          items: [
            {
              id: 'companies-list',
              label: this.$t('settingsNav.companiesList'),
              icon: 'mdi-domain',
              route: '/groups',
              visible: true,
              superAdminOnly: true,
              exact: true,
            },
          ],
        });
      }

      // General category
      items.push({
        category: 'general',
        label: this.$t('settingsNav.categories.general'),
        items: [
          {
            id: 'general',
            label: this.$t('groups.tabs.general'),
            icon: 'mdi-cog-outline',
            route: `${this.settingsBasePath}/general`,
            visible: true,
            superAdminOnly: false,
          },
          {
            id: 'workspaces',
            label: this.$tc('global.teams', 2),
            icon: 'mdi-account-group-outline',
            route: `${this.settingsBasePath}/workspaces`,
            visible: canAccessGroupAdmin,
            superAdminOnly: false,
          },
          {
            id: 'users',
            label: this.$tc('global.user', 2),
            icon: 'mdi-account-outline',
            route: `${this.settingsBasePath}/users`,
            visible: true,
            superAdminOnly: false,
          },
          {
            id: 'integrations',
            label: this.$t('integrations.title'),
            icon: 'mdi-connection',
            route: `${this.settingsBasePath}/integrations`,
            visible: canAccessGroupAdmin,
            superAdminOnly: false,
          },
          {
            id: 'ai-features',
            label: this.$t('aiFeatures.title'),
            icon: 'mdi-robot-outline',
            route: `${this.settingsBasePath}/ai-features`,
            visible: canAccessGroupAdmin,
            superAdminOnly: false,
          },
        ],
      });

      // Email Builder category
      items.push({
        category: 'emailBuilder',
        label: this.$t('settingsNav.categories.emailBuilder'),
        items: [
          {
            id: 'export-options',
            label: this.$t('exportOptions.title'),
            icon: 'mdi-package-down',
            route: `${this.settingsBasePath}/export-options`,
            visible: this.isAdmin,
            superAdminOnly: true,
          },
          {
            id: 'colors',
            label: this.$t('settingsNav.colors'),
            icon: 'mdi-palette-outline',
            route: `${this.settingsBasePath}/colors`,
            visible: canAccessGroupAdmin,
            superAdminOnly: false,
          },
          {
            id: 'templates',
            label: this.$tc('global.template', 2),
            icon: 'mdi-file-document-outline',
            route: `${this.settingsBasePath}/templates`,
            visible: this.isAdmin,
            superAdminOnly: true,
          },
          {
            id: 'mailings',
            label: this.$tc('global.mailing', 2),
            icon: 'mdi-email-outline',
            route: `${this.settingsBasePath}/mailings`,
            visible: this.isAdmin,
            superAdminOnly: true,
          },
          {
            id: 'profiles',
            label: this.$tc('global.profile', 2),
            icon: 'mdi-send-outline',
            route: `${this.settingsBasePath}/profiles`,
            visible: this.isAdmin,
            superAdminOnly: true,
          },
          {
            id: 'emails-groups',
            label: this.$tc('global.emailsGroups', 2),
            icon: 'mdi-email-multiple-outline',
            route: `${this.settingsBasePath}/emails-groups`,
            visible: canAccessGroupAdmin,
            superAdminOnly: false,
          },
          {
            id: 'variables',
            label: this.$t('global.variables'),
            icon: 'mdi-code-braces',
            route: `${this.settingsBasePath}/variables`,
            visible: canAccessGroupAdmin,
            superAdminOnly: false,
          },
        ],
      });

      // CRM Intelligence category
      items.push({
        category: 'crmIntelligence',
        label: this.$t('settingsNav.categories.crmIntelligence'),
        items: [
          {
            id: 'crm-intelligence',
            label: this.$t('crmIntelligence.dashboards'),
            icon: 'mdi-chart-line',
            route: `${this.settingsBasePath}/crm-intelligence`,
            visible: this.isAdmin,
            superAdminOnly: true,
            disabled: !this.group.enableCrmIntelligence,
            disabledTooltip: this.$t('groups.modules.notEnabled'),
          },
        ],
      });

      return items;
    },
    visibleCategories() {
      return this.navItems
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => item.visible),
        }))
        .filter((category) => category.items.length > 0);
    },
  },
  methods: {
    isActive(route) {
      return this.$route.path === route;
    },
  },
};
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-list dense nav>
        <!-- Back link -->
        <v-list-item nuxt class="mb-4" link to="/mailings">
          <v-list-item-icon class="mr-3">
            <lucide-arrow-left :size="20" />
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.backToMails') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>

        <!-- Navigation categories -->
        <template v-for="category in visibleCategories">
          <v-subheader :key="`header-${category.category}`" class="text-uppercase">
            {{ category.label }}
          </v-subheader>

          <v-list-item
            v-for="item in category.items"
            :key="item.id"
            :class="{ 'v-list-item--active': isActive(item.route) }"
            :disabled="item.disabled"
            :to="item.disabled ? undefined : item.route"
            :nuxt="!item.disabled"
            :exact="item.exact"
            link
          >
            <v-list-item-icon class="mr-3">
              <v-tooltip v-if="item.disabled && item.disabledTooltip" right>
                <template #activator="{ on, attrs }">
                  <v-icon v-bind="attrs" :color="isActive(item.route) ? 'accent' : ''" v-on="on">
                    {{ item.icon }}
                  </v-icon>
                </template>
                <span>{{ item.disabledTooltip }}</span>
              </v-tooltip>
              <v-icon v-else :color="isActive(item.route) ? 'accent' : ''">
                {{ item.icon }}
              </v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title>
                {{ item.label }}
              </v-list-item-title>
            </v-list-item-content>
            <!-- Super admin only indicator -->
            <v-list-item-action v-if="item.superAdminOnly" class="super-admin-indicator">
              <v-tooltip right>
                <template #activator="{ on, attrs }">
                  <lucide-shield
                    v-bind="attrs"
                    :size="16"
                    class="super-admin-icon"
                    v-on="on"
                  />
                </template>
                <span>{{ $t('settingsNav.superAdminOnly') }}</span>
              </v-tooltip>
            </v-list-item-action>
          </v-list-item>
        </template>
      </v-list>
    </v-col>
  </v-row>
</template>

<style scoped>
.v-list-item--active {
  background-color: rgba(0, 172, 220, 0.08);
}

.v-list-item--active .v-list-item__title {
  color: var(--v-accent-base);
  font-weight: 500;
}

.v-subheader {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.6);
  height: 32px;
  margin-top: 8px;
}

.v-list-item__title {
  font-size: 0.875rem;
}

.v-list-item__icon {
  margin-right: 12px !important;
}

.super-admin-indicator {
  margin: 0 !important;
  min-width: auto !important;
}

.super-admin-icon {
  color: rgba(0, 0, 0, 0.38);
}

.v-list-item--active .super-admin-icon {
  color: var(--v-accent-base);
}
</style>
