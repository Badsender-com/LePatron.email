<script>
import { ChevronRight } from 'lucide-vue';

export default {
  name: 'BsBreadcrumb',
  components: {
    LucideChevronRight: ChevronRight,
  },
  props: {
    items: {
      type: Array,
      required: true,
      // Format: [{ text: 'Workspaces', to: '/mailings' }, { text: 'Clarins', to: null }]
      // Last item (current page) should have to: null
    },
  },
  computed: {
    visibleItems() {
      // On mobile, collapse to "... > current" if more than 2 items
      if (this.$vuetify?.breakpoint?.mobile && this.items.length > 2) {
        return [
          { text: '…', to: null, isEllipsis: true },
          this.items[this.items.length - 1],
        ];
      }
      return this.items;
    },
  },
};
</script>

<template>
  <ol class="bsph__crumbs" :aria-label="$t('sidebar.aria.breadcrumb')">
    <template v-for="(item, index) in visibleItems">
      <li
        :key="`crumb-${index}`"
        class="bsph__crumb"
        :class="{ 'bsph__crumb--current': !item.to && !item.isEllipsis }"
        :aria-current="!item.to && !item.isEllipsis ? 'page' : null"
      >
        <nuxt-link v-if="item.to" :to="item.to">
          {{ item.text }}
        </nuxt-link>
        <span v-else>{{ item.text }}</span>
      </li>
      <li
        v-if="index < visibleItems.length - 1"
        :key="`sep-${index}`"
        class="bsph__sep"
        aria-hidden="true"
      >
        <lucide-chevron-right :size="14" />
      </li>
    </template>
  </ol>
</template>

<style scoped>
/* =========================================================================
   BsBreadcrumb — used inside BsPageHeader #breadcrumb slot
   Spec: /tmp/lepatron-design-v3/preview/components-page-header.html
   ========================================================================= */

.bsph__crumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 16px;
  line-height: 1.3;
  min-width: 0;
}

.bsph__crumb {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--gray-600);
}

.bsph__crumb a {
  color: var(--gray-600);
  text-decoration: none;
  border-radius: var(--r-xs);
  padding: 2px 4px;
  margin: -2px -4px;
  transition: background var(--t-fast), color var(--t-fast);
}

.bsph__crumb a:hover {
  color: var(--v-primary-base);
  background: var(--gray-100);
}

.bsph__crumb--current {
  color: var(--gray-900);
  font-weight: 600;
}

.bsph__sep {
  color: var(--gray-400);
  display: inline-flex;
  align-items: center;
}

/* Mobile adjustments */
@media (max-width: 960px) {
  .bsph__crumbs {
    font-size: 14px;
  }
}
</style>
