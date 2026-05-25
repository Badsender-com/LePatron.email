<template>
  <div class="bs-row-actions">
    <!-- Quick action icons (always visible).
         aria-label carries the meaning for screen readers and keyboard
         users; we don't render a hover tooltip — the icons are standard
         (Pencil/Trash2/Send/...) and the kebab menu already exposes
         text labels for less-obvious actions. -->
    <button
      v-for="action in quickActions"
      :key="action.key"
      class="qa-btn"
      :class="{ 'qa-btn--danger': action.variant === 'danger' }"
      :aria-label="$t(action.text)"
      @click.stop="action.onClick"
    >
      <span v-if="action.badge" class="qa-badge-wrap">
        <component :is="action.icon" :size="18" />
        <span class="qa-badge">{{ formatBadgeCount(action.badge) }}</span>
      </span>
      <component :is="action.icon" v-else :size="18" />
    </button>

    <!-- Divider -->
    <span v-if="menuActions.length > 0" class="actions-cell__divider" />

    <!-- Kebab menu (more actions) -->
    <v-menu
      v-if="menuActions.length > 0"
      offset-y
      bottom
      left
      nudge-bottom="4"
      min-width="220"
      max-width="320"
      content-class="bs-row-actions-menu"
      :close-on-content-click="true"
    >
      <template #activator="{ on, attrs, value }">
        <button
          class="am-trigger"
          :class="{ 'am-trigger--open': value }"
          :aria-label="$t('sidebar.aria.moreActions')"
          :aria-expanded="value"
          v-bind="attrs"
          v-on="on"
          @click.stop
        >
          <lucide-more-horizontal :size="16" />
        </button>
      </template>

      <v-list class="am-panel">
        <template v-for="(action, index) in menuActions">
          <!-- Divider -->
          <div
            v-if="action.type === 'divider'"
            :key="`divider-${index}`"
            class="am-divider"
          />

          <!-- Menu item -->
          <v-list-item
            v-else
            :key="action.key"
            class="am-item"
            :class="{
              'am-item--danger': action.variant === 'danger',
              'am-item--disabled': action.disabled,
            }"
            :disabled="action.disabled"
            @click.stop="action.onClick"
          >
            <div class="am-item__icon">
              <component :is="action.icon" :size="16" />
            </div>
            <div class="am-item__label">
              {{ $t(action.text) }}
            </div>
            <div v-if="action.count" class="am-item__count">
              {{ action.count }}
            </div>
          </v-list-item>
        </template>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import { MoreHorizontal } from 'lucide-vue';

export default {
  name: 'BsRowActions',
  components: {
    LucideMoreHorizontal: MoreHorizontal,
  },
  props: {
    /**
     * Quick actions (always visible inline, max 4)
     * Array of { key, icon, text, onClick, variant?, badge? }
     */
    quickActions: {
      type: Array,
      default: () => [],
      validator: (actions) => actions.length <= 4,
    },
    /**
     * Menu actions (behind kebab menu)
     * Array of { key, icon, text, onClick, variant?, disabled?, count? }
     * OR { type: 'divider' } for separators
     */
    menuActions: {
      type: Array,
      default: () => [],
    },
  },
  methods: {
    formatBadgeCount(count) {
      return count > 99 ? '99+' : count;
    },
  },
};
</script>

<style lang="scss" scoped>
/* =========================================================================
   Row Actions — LePatron Design System v1.0
   Based on: /tmp/lepatron-design/project/preview/components-action-menu.html
   ========================================================================= */

.bs-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

/* Quick action icon button ============================================== */
.qa-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  color: var(--gray-600);
  cursor: pointer;
  transition: background 0.2s ease-out, color 0.2s ease-out;
  position: relative;
  padding: 0;

  &:hover {
    background: var(--gray-100);
    color: var(--v-primary-base);
  }

  &:focus-visible {
    outline: 2px solid var(--v-accent-base);
    outline-offset: 1px;
  }

  &--danger {
    color: var(--color-error);

    &:hover {
      background: var(--color-error-bg);
      color: var(--color-error);
    }
  }
}

/* Comment badge ========================================================= */
.qa-badge-wrap {
  position: relative;
  display: inline-flex;
}

.qa-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--v-accent-base);
  color: var(--text-on-accent);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  box-sizing: border-box;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Divider =============================================================== */
.actions-cell__divider {
  width: 1px;
  height: 18px;
  background: var(--gray-300);
  margin: 0 4px;
}

/* Kebab trigger ========================================================= */
.am-trigger {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  color: var(--gray-600);
  cursor: pointer;
  transition: background 0.2s ease-out, color 0.2s ease-out;
  padding: 0;

  &:hover {
    background: var(--gray-100);
    color: var(--v-primary-base);
  }

  &--open {
    background: var(--gray-200);
    color: var(--v-primary-base);
  }
}
</style>

<style lang="scss">
/* =========================================================================
   Menu panel (unscoped - applied to v-menu content-class)
   ========================================================================= */

.bs-row-actions-menu {
  border-radius: var(--r-md) !important;
  box-shadow: var(--shadow-menu) !important;

  .v-list {
    padding: 6px !important;
    background: var(--surface) !important;
    border: 1px solid var(--gray-300) !important;
    border-radius: var(--r-md) !important;
  }
}

/* Menu panel ============================================================ */
.am-panel {
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}

/* Menu item ============================================================= */
.am-item {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  width: 100% !important;
  padding: 0 8px !important;
  min-height: 32px !important;
  height: 32px !important;
  border: none !important;
  background: transparent !important;
  border-radius: 6px !important;
  color: var(--gray-900) !important;
  font-size: 13px !important;
  font-weight: 400 !important;
  text-align: left !important;
  cursor: pointer !important;
  transition: background 0.15s ease-out !important;

  // Override Vuetify defaults
  &::before {
    display: none !important;
  }

  &:hover {
    background: var(--gray-100) !important;
  }

  &:focus-visible {
    outline: none !important;
    background: var(--gray-100) !important;
    box-shadow: inset 0 0 0 1px var(--v-accent-base) !important;
  }

  &__icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: var(--gray-600);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__count {
    flex-shrink: 0;
    background: var(--gray-200);
    color: var(--gray-700);
    font-size: 11px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: var(--r-pill);
  }

  // Disabled state
  &--disabled {
    color: var(--gray-400) !important;
    cursor: not-allowed !important;

    .am-item__icon {
      color: var(--gray-400) !important;
    }

    &:hover {
      background: transparent !important;
    }
  }

  // Danger variant
  &--danger {
    color: var(--color-error) !important;

    .am-item__icon {
      color: var(--color-error) !important;
    }

    &:hover {
      background: var(--color-error-bg) !important;
    }
  }
}

/* Divider =============================================================== */
.am-divider {
  height: 1px;
  background: var(--gray-200);
  margin: 6px 4px;
}
</style>
