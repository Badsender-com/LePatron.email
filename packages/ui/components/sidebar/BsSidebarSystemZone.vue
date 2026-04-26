<template>
  <nav class="bs-sidebar-system-zone">
    <v-tooltip
      v-for="item in systemItems"
      :key="item.id"
      :disabled="!collapsed"
      right
    >
      <template #activator="{ on }">
        <button
          class="bs-sidebar-system-item"
          :class="{ 'bs-sidebar-system-item--active': isActive(item) }"
          v-on="on"
          @click="handleClick(item)"
        >
          <component :is="getIconComponent(item.icon)" :size="20" />
          <span v-if="!collapsed" class="bs-sidebar-system-item__label">
            {{ $t(item.labelKey) }}
          </span>
        </button>
      </template>
      <span>{{ $t(item.labelKey) }}</span>
    </v-tooltip>
  </nav>
</template>

<script>
import { Settings, HelpCircle, LogOut } from 'lucide-vue';
import { mapActions, mapGetters } from 'vuex';
import { SYSTEM_ITEMS } from './sidebar-config.js';
import { USER, LOGOUT } from '~/store/user';

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
      userGroup: 'group',
    }),

    systemItems() {
      return SYSTEM_ITEMS;
    },

    groupId() {
      return this.userGroup?._id || this.userGroup?.id;
    },
  },
  methods: {
    ...mapActions(USER, {
      logout: LOGOUT,
    }),

    getIconComponent(iconName) {
      return ICON_MAP[iconName];
    },

    isActive(item) {
      if (item.id === 'settings') {
        return (
          this.$route.path.startsWith('/groups/') &&
          this.$route.path.includes('/edit')
        );
      }
      return false;
    },

    handleClick(item) {
      if (item.route) {
        const route =
          item.route === '/groups'
            ? `/groups/${this.groupId}/edit`
            : item.route;
        this.$router.push(route);
      } else if (item.action === 'openHelp') {
        this.$emit('open-help');
      } else if (item.action === 'logout') {
        this.logout();
      }
    },
  },
};
</script>

<style scoped>
.bs-sidebar-system-zone {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-top: 1px solid #e0e0e0;
  margin-top: auto;
}

.bs-sidebar-system-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 200ms;
  color: var(--v-primary-base, #093040);
  width: 100%;
  text-align: left;
}

.bs-sidebar-system-item:hover {
  background: #f5f5f5;
}

.bs-sidebar-system-item--active {
  background: rgba(0, 172, 220, 0.1);
  color: var(--v-accent-base, #00acdc);
}

.bs-sidebar-system-item__label {
  font-size: 14px;
  font-weight: 400;
}
</style>
