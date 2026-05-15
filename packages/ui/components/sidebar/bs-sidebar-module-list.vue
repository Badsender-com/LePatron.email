<template>
  <nav class="bs-sidebar-module-list">
    <v-tooltip
      v-for="module in modules"
      :key="module.id"
      :disabled="!collapsed"
      right
    >
      <template #activator="{ on }">
        <button
          class="bs-sidebar-module"
          :class="{
            'bs-sidebar-module--active': module.id === activeModule,
            'bs-sidebar-module--locked': module.locked,
          }"
          :aria-label="
            module.locked
              ? $t('sidebar.moduleLockedLabel', { module: $t(module.labelKey) })
              : $t(module.labelKey)
          "
          :aria-current="module.id === activeModule ? 'page' : null"
          :aria-disabled="module.locked ? 'true' : null"
          v-on="on"
          @click="$emit('select', module)"
        >
          <component :is="getIconComponent(module.icon)" :size="20" />
          <span v-if="!collapsed" class="bs-sidebar-module__label">
            {{ $t(module.labelKey) }}
          </span>
          <!-- Lock icon hidden in collapsed mode: it would overlap the main
               icon since the label disappears and the absolute-positioned
               lock has no room. -->
          <component
            :is="getIconComponent('Lock')"
            v-if="module.locked && !collapsed"
            :size="14"
            class="bs-sidebar-module__lock"
          />
        </button>
      </template>
      <span>{{ $t(module.labelKey) }}</span>
    </v-tooltip>
  </nav>
</template>

<script>
import { Mail, LineChart, Shield, Palette, Sparkles, Lock } from 'lucide-vue';

const ICON_MAP = {
  Mail,
  LineChart,
  Shield,
  Palette,
  Sparkles,
  Lock,
};

export default {
  name: 'BsSidebarModuleList',
  components: {
    Mail,
    LineChart,
    Shield,
    Palette,
    Sparkles,
    Lock,
  },
  props: {
    modules: {
      type: Array,
      required: true,
    },
    activeModule: {
      type: String,
      default: null,
    },
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    getIconComponent(iconName) {
      return ICON_MAP[iconName] || Mail;
    },
  },
};
</script>

<style scoped>
.bs-sidebar-module-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.bs-sidebar-module {
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
  position: relative;
  width: 100%;
  text-align: left;
}

.bs-sidebar-module:hover {
  background: #f5f5f5;
}

.bs-sidebar-module--active {
  background: rgba(0, 172, 220, 0.1);
  color: var(--v-accent-base, #00acdc);
  font-weight: 600;
}

.bs-sidebar-module--locked {
  opacity: 0.65;
}

.bs-sidebar-module__label {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

.bs-sidebar-module--active .bs-sidebar-module__label {
  font-weight: 600;
}

.bs-sidebar-module__lock {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  color: #9e9e9e;
}
</style>
