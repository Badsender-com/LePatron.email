<script>
import {
  Palette,
  LineChart,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-vue';

// Map icon names to Lucide components
const ICON_MAP = {
  palette: Palette,
  'line-chart': LineChart,
  settings: Settings,
  'help-circle': HelpCircle,
  'log-out': LogOut,
};

export default {
  name: 'BsSidebarItem',
  components: {
    Palette,
    LineChart,
    Settings,
    HelpCircle,
    LogOut,
  },
  props: {
    to: {
      type: String,
      default: null,
    },
    href: {
      type: String,
      default: null,
    },
    target: {
      type: String,
      default: null,
    },
    icon: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    tag() {
      if (this.to) return 'nuxt-link';
      if (this.href) return 'a';
      return 'div';
    },
    linkProps() {
      if (this.to) return { to: this.to };
      if (this.href) return { href: this.href, target: this.target };
      return {};
    },
    lucideIcon() {
      return ICON_MAP[this.icon] || null;
    },
    iconColor() {
      return this.active ? '#00acdc' : '#757575';
    },
  },
};
</script>

<template>
  <component
    :is="tag"
    v-bind="linkProps"
    class="sidebar-item"
    :class="{
      'sidebar-item--active': active,
      'sidebar-item--disabled': disabled,
    }"
  >
    <!-- Active indicator bar -->
    <div class="sidebar-item__indicator" />

    <div class="sidebar-item__icon">
      <component
        :is="lucideIcon"
        :size="22"
        :color="iconColor"
        :stroke-width="2"
      />
    </div>
    <span class="sidebar-item__label">
      {{ label }}
    </span>
  </component>
</template>

<style scoped>
.sidebar-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 44px;
  margin: 2px 4px;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.sidebar-item:hover {
  background-color: #f5f5f5;
}

.sidebar-item--active {
  background-color: rgba(0, 172, 220, 0.12);
}

.sidebar-item--disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* Active indicator - left border */
.sidebar-item__indicator {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background-color: transparent;
  transition: background-color 150ms ease;
}

.sidebar-item--active .sidebar-item__indicator {
  background-color: #00acdc;
}

/* Icon container */
.sidebar-item__icon {
  width: 48px;
  min-width: 48px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-item:hover .sidebar-item__icon svg {
  transform: scale(1.05);
}

.sidebar-item__icon svg {
  transition: transform 150ms ease;
}

/* Label */
.sidebar-item__label {
  font-size: 14px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.87);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 16px;
}

.sidebar-item--active .sidebar-item__label {
  font-weight: 500;
  color: #00acdc;
}
</style>
