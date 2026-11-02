<template>
  <nav
    class="bs-sidebar-system-zone"
    :class="{ 'bs-sidebar-system-zone--collapsed': collapsed }"
  >
    <v-tooltip v-for="item in systemItems" :key="item.id" top>
      <template #activator="{ on }">
        <button
          class="bs-sidebar-system-item"
          :class="{ 'bs-sidebar-system-item--active': isActive(item) }"
          :aria-label="$t(item.labelKey)"
          v-on="on"
          @click="handleClick(item)"
        >
          <component :is="getIconComponent(item.icon)" :size="16" />
        </button>
      </template>
      <span>{{ $t(item.labelKey) }}</span>
    </v-tooltip>
  </nav>
</template>

<script>
import { Settings, HelpCircle, LogOut } from 'lucide-vue';
import { mapGetters } from 'vuex';
import { SYSTEM_ITEMS } from './sidebar-config.js';
import { CAN, GROUP, SELECTED_GROUP, USER } from '~/store/user';
import { CAPABILITIES } from '../../../shared/access/roles.js';

const ICON_MAP = {
  Settings,
  HelpCircle,
  LogOut,
};

export default {
  name: 'BsSidebarSystemZone',
  components: {
    Settings,
    HelpCircle,
    LogOut,
  },
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    ...mapGetters(USER, {
      userGroup: GROUP,
      selectedGroup: SELECTED_GROUP,
      can: CAN,
    }),

    systemItems() {
      // The settings are for whoever manages a company, or the platform.
      const canAccessSettings = this.can(CAPABILITIES.GROUP_MANAGE);

      return SYSTEM_ITEMS.filter((item) => {
        // Settings is only for admins and group admins
        if (item.id === 'settings') {
          return canAccessSettings;
        }
        // All other items (help, logout) are for everyone
        return true;
      });
    },

    // The settings of the selected group (ADR 0002, amended): a super admin's
    // choice, anyone else's own group. The bootstrap account before it chooses
    // a group has none, and opens the groups list instead.
    settingsRoute() {
      const groupId =
        this.selectedGroup?.id || this.userGroup?._id || this.userGroup?.id;
      return groupId ? `/groups/${groupId}/settings/general` : '/groups';
    },
  },
  methods: {
    getIconComponent(iconName) {
      return ICON_MAP[iconName];
    },

    isActive(item) {
      if (item.id === 'settings') {
        return (
          this.$route.path.startsWith('/groups/') &&
          this.$route.path.includes('/settings')
        );
      }
      return false;
    },

    handleClick(item) {
      if (item.route) {
        const route =
          item.route === '/groups' ? this.settingsRoute : item.route;
        this.$router.push(route);
      } else if (item.action === 'openHelp') {
        this.$emit('open-help');
      } else if (item.action === 'logout') {
        window.location.href = '/account/logout';
      }
    },
  },
};
</script>

<style scoped>
.bs-sidebar-system-zone {
  display: flex;
  flex-direction: row;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
  align-items: center;
}

.bs-sidebar-system-zone--collapsed {
  flex-direction: column;
  padding: 8px;
}

.bs-sidebar-system-item {
  flex: 1;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #757575;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 200ms ease, color 200ms ease;
}

.bs-sidebar-system-zone--collapsed .bs-sidebar-system-item {
  flex: none;
  width: 32px;
}

.bs-sidebar-system-item:hover {
  background: #f5f5f5;
  color: #212121;
}

.bs-sidebar-system-item--active {
  background: rgba(0, 172, 220, 0.1);
  color: var(--v-primary-base, #093040);
}
</style>
