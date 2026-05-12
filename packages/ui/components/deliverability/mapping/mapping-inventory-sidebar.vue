<template>
  <div class="inv-sidebar">
    <div class="inv-sidebar__header">
      <icon-layers :size="16" />
      <span>{{ $t('deliverability.mapping.sidebar.title') }}</span>
    </div>

    <div class="inv-sidebar__hint">
      {{ $t('deliverability.mapping.sidebar.hint') }}
    </div>

    <div class="inv-sidebar__sections">
      <div
        v-for="section in sections"
        :key="section.category"
        class="inv-section"
      >
        <!-- Section header -->
        <button
          class="inv-section__header"
          @click="toggleSection(section.category)"
        >
          <component :is="section.icon" :size="14" />
          <span class="inv-section__label">{{
            $t(`deliverability.mapping.sidebar.${section.labelKey}`)
          }}</span>
          <span class="inv-section__count">{{
            sectionItems(section.category).length
          }}</span>
          <icon-chevron-down
            :size="13"
            :style="{
              transform: openSections[section.category]
                ? 'rotate(0deg)'
                : 'rotate(-90deg)',
              transition: 'transform 0.15s',
            }"
          />
        </button>

        <!-- Draggable items -->
        <div v-if="openSections[section.category]" class="inv-section__body">
          <draggable
            :list="sectionItems(section.category)"
            :group="{
              name: `inv-${section.category}`,
              pull: 'clone',
              put: false,
            }"
            :clone="cloneItem"
            :sort="false"
            class="inv-section__items"
          >
            <div
              v-for="item in sectionItems(section.category)"
              :key="item.id"
              class="inv-item"
            >
              <icon-grip-vertical :size="12" class="inv-item__grip" />
              <span class="inv-item__value">{{ item.value }}</span>
              <span v-if="item.description" class="inv-item__desc">{{
                item.description
              }}</span>
            </div>
          </draggable>

          <div
            v-if="sectionItems(section.category).length === 0"
            class="inv-section__empty"
          >
            {{ $t('deliverability.mapping.sidebar.noItems') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import draggable from 'vuedraggable';

const SECTIONS = [
  {
    category: 'display_from_domain',
    icon: 'icon-globe',
    labelKey: 'fromDomains',
  },
  { category: 'ip', icon: 'icon-network', labelKey: 'ips' },
  { category: 'mail_from_domain', icon: 'icon-mail', labelKey: 'mailFrom' },
  { category: 'reply_to', icon: 'icon-mail', labelKey: 'replyTo' },
  {
    category: 'tracking_domain',
    icon: 'icon-link',
    labelKey: 'trackingDomains',
  },
  {
    category: 'hosting_domain',
    icon: 'icon-image',
    labelKey: 'hostingDomains',
  },
  {
    category: 'link_destination_domain',
    icon: 'icon-external-link',
    labelKey: 'linkDestinationDomains',
  },
];

export default {
  name: 'MappingInventorySidebar',
  components: { draggable },
  props: {
    inventoryItems: { type: Object, default: () => ({}) },
  },
  data() {
    const openSections = {};
    SECTIONS.forEach((s) => {
      openSections[s.category] = true;
    });
    return {
      sections: SECTIONS,
      openSections,
    };
  },
  methods: {
    sectionItems(category) {
      return this.inventoryItems[category] || [];
    },
    toggleSection(category) {
      this.$set(this.openSections, category, !this.openSections[category]);
    },
    cloneItem(item) {
      return { ...item };
    },
  },
};
</script>

<style scoped>
.inv-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.inv-sidebar__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--gray-600);
}

.inv-sidebar__hint {
  padding: 0 16px 12px;
  font-size: 11px;
  color: var(--gray-400);
  line-height: 1.4;
  border-bottom: 1px solid var(--gray-100);
}

.inv-sidebar__sections {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.inv-section__header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 16px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--gray-600);
  transition: background var(--t-fast);
}

.inv-section__header:hover {
  background: var(--gray-50);
}

.inv-section__label {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
}

.inv-section__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--gray-100);
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
  color: var(--gray-500);
}

.inv-section__body {
  padding: 4px 10px 8px;
}

.inv-section__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 4px;
}

.inv-section__empty {
  font-size: 11px;
  color: var(--gray-400);
  padding: 6px 6px;
  font-style: italic;
}

.inv-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--r-sm);
  cursor: grab;
  transition: all var(--t-fast);
}

.inv-item:hover {
  background: var(--white);
  border-color: #00acdc;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.inv-item:active {
  cursor: grabbing;
}

.inv-item__grip {
  color: var(--gray-300);
  flex-shrink: 0;
}

.inv-item__value {
  font-size: 12px;
  color: var(--gray-700);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.inv-item__desc {
  font-size: 10px;
  color: var(--gray-400);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}
</style>
