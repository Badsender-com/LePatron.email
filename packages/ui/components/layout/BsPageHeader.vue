<script>
import { ChevronLeft, Menu } from 'lucide-vue';

export default {
  name: 'BsPageHeader',
  components: {
    LucideChevronLeft: ChevronLeft,
    LucideMenu: Menu,
  },
  props: {
    // Back button prop: true (emit @back) or { to: string } (navigate)
    back: {
      type: [Boolean, Object],
      default: false,
    },
    // Show mobile menu trigger (default true, set false for fullscreen wizards)
    showMobileMenu: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    hasBackButton() {
      return !!this.back;
    },
    backRoute() {
      return typeof this.back === 'object' ? this.back.to : null;
    },
    isMobile() {
      return this.$vuetify?.breakpoint?.mobile || false;
    },
  },
  methods: {
    handleBackClick() {
      if (this.backRoute) {
        this.$router.push(this.backRoute);
      } else {
        this.$emit('back');
      }
    },
    handleMobileMenuClick() {
      this.$emit('toggle-mobile-menu');
    },
  },
};
</script>

<template>
  <header class="bsph">
    <div class="bsph__left">
      <!-- Mobile menu trigger (only visible on mobile) -->
      <button
        v-if="showMobileMenu && isMobile"
        class="bsph__menu"
        aria-label="Open navigation"
        @click="handleMobileMenuClick"
      >
        <lucide-menu :size="20" />
      </button>

      <!-- Back button (optional) -->
      <button
        v-if="hasBackButton"
        class="bsph__back"
        :aria-label="backRoute ? `Back to ${backRoute}` : 'Back'"
        @click="handleBackClick"
      >
        <lucide-chevron-left :size="18" />
      </button>

      <!-- Title or breadcrumb wrapper -->
      <div class="bsph__title-wrap">
        <!-- Breadcrumb slot (variant 1) -->
        <slot v-if="$slots.breadcrumb" name="breadcrumb" />

        <!-- Title slot (variants 2, 3, 4) -->
        <h1 v-else-if="$slots.title" class="bsph__title">
          <slot name="title" />
        </h1>

        <!-- Badge slot (optional, used with title) -->
        <span v-if="$slots.badge" class="bsph__badge">
          <slot name="badge" />
        </span>
      </div>
    </div>

    <!-- Actions slot (right zone) -->
    <div v-if="$slots.actions" class="bsph__right">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
/* =========================================================================
   BsPageHeader — unified in-content page header
   Spec: /tmp/lepatron-design-v3/preview/components-page-header.html
   ========================================================================= */

.bsph {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--page-header-bg);
  border-bottom: var(--page-header-border);
  padding: 24px 32px 20px 32px;
  min-height: var(--page-header-min-height);
  box-sizing: border-box;
  font-family: inherit;
  margin-bottom: 24px;
}

/* Left zone — title or breadcrumb + optional back/badge */
.bsph__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.bsph__back {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
  color: var(--gray-700);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--t-fast), color var(--t-fast);
}

.bsph__back:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.bsph__menu {
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
  color: var(--gray-700);
  cursor: pointer;
  display: none; /* shown only at < --mobile-breakpoint */
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--t-fast), color var(--t-fast);
}

.bsph__menu:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.bsph__title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.bsph__title {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--gray-900);
  margin: 0;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bsph__badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  background: rgba(0, 172, 220, 0.1);
  color: var(--v-primary-base);
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

/* Right zone — actions slot */
.bsph__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Mobile adjustments */
@media (max-width: 960px) {
  .bsph {
    padding: 18px 16px;
    min-height: 64px;
    margin-bottom: 16px;
  }

  .bsph__menu {
    display: inline-flex;
  }

  .bsph__title {
    font-size: 18px;
  }
}

/* Responsive wrapping - actions wrap before title truncates */
@media (max-width: 640px) {
  .bsph {
    flex-wrap: wrap;
  }

  .bsph__right {
    flex-basis: 100%;
    justify-content: flex-end;
  }
}
</style>
