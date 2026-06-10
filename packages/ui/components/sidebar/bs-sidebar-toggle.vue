<template>
  <button
    class="bs-sidebar-toggle"
    :aria-label="collapsed ? $t('sidebar.expand') : $t('sidebar.collapse')"
    @click="$emit('toggle')"
  >
    <lucide-chevron-left v-if="!collapsed" :size="16" />
    <lucide-chevron-right v-else :size="16" />
  </button>
</template>

<script>
import { ChevronLeft, ChevronRight } from 'lucide-vue';

export default {
  name: 'BsSidebarToggle',
  components: {
    LucideChevronLeft: ChevronLeft,
    LucideChevronRight: ChevronRight,
  },
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style scoped>
.bs-sidebar-toggle {
  position: absolute;
  top: 14px;
  right: -12px;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 200ms ease;
  z-index: 20;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.bs-sidebar-toggle:hover {
  background: #f5f5f5;
  border-color: var(--v-accent-base, #00acdc);
}

.bs-sidebar-toggle:active {
  transform: scale(0.95);
}
</style>
