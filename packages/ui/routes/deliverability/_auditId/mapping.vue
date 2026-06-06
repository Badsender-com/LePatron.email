<template>
  <div class="mapping-page">
    <bs-page-header
      :back="{ to: `/deliverability/${auditId}` }"
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('deliverability.mapping.title') }}
      </template>
      <template #actions>
        <button
          class="toolbar-btn toolbar-btn--secondary"
          @click="exportMarkdown"
        >
          <icon-copy :size="16" />
          {{ $t('deliverability.mapping.exportMarkdown') }}
        </button>
        <button class="toolbar-btn toolbar-btn--secondary" @click="addGroup">
          <icon-layers :size="16" />
          {{ $t('deliverability.mapping.addGroup') }}
        </button>
        <button
          class="toolbar-btn toolbar-btn--primary"
          @click="addEntry(null)"
        >
          <icon-plus :size="16" />
          {{ $t('deliverability.mapping.addEntry') }}
        </button>
      </template>
    </bs-page-header>

    <div class="mapping-layout">
      <!-- Inventory sidebar -->
      <aside class="mapping-sidebar">
        <mapping-inventory-sidebar :inventory-items="inventoryItems" />
      </aside>

      <!-- Canvas -->
      <main class="mapping-main">
        <!-- Empty state -->
        <div
          v-if="localGroups.length === 0 && localUngrouped.length === 0"
          class="mapping-empty"
        >
          <icon-layers :size="48" />
          <h3>{{ $t('deliverability.mapping.empty.title') }}</h3>
          <p>{{ $t('deliverability.mapping.empty.description') }}</p>
          <button
            class="toolbar-btn toolbar-btn--primary"
            @click="addEntry(null)"
          >
            <icon-plus :size="16" />
            {{ $t('deliverability.mapping.addEntry') }}
          </button>
        </div>

        <template v-else>
          <!-- Groups -->
          <draggable
            :list="localGroups"
            handle=".mapping-group__drag-handle"
            ghost-class="group-ghost"
            :animation="150"
            @end="saveGroupsOrder"
          >
            <mapping-group
              v-for="group in localGroups"
              :key="group.id"
              :group="group"
              :entries="group.entries"
              :inventory-map="inventoryMap"
              :inventory-items="inventoryItems"
              class="mapping-canvas__item"
              @update-group="onUpdateGroup"
              @entries-changed="onGroupEntriesChanged"
              @update-entry="onUpdateEntry"
              @delete-entry="onDeleteEntry"
              @delete="onDeleteGroup(group.id)"
            >
              <template #actions>
                <button
                  class="toolbar-btn toolbar-btn--secondary toolbar-btn--sm"
                  @click="addEntry(group.id)"
                >
                  <icon-plus :size="13" />
                  {{ $t('deliverability.mapping.addEntryToGroup') }}
                </button>
              </template>
            </mapping-group>
          </draggable>

          <!-- Ungrouped entries -->
          <draggable
            :list="localUngrouped"
            :group="{ name: 'mapping-cards' }"
            handle=".drag-handle"
            ghost-class="card-ghost"
            :animation="150"
            class="mapping-canvas__ungrouped"
            @change="(evt) => onUngroupedChanged(evt)"
          >
            <mapping-card
              v-for="entry in localUngrouped"
              :key="entry.id"
              :entry="entry"
              :inventory-map="inventoryMap"
              :inventory-items="inventoryItems"
              :is-new="newEntryId === entry.id"
              class="mapping-canvas__item"
              @update="
                (payload) => onUpdateEntry({ ...payload, entryId: entry.id })
              "
              @delete="onDeleteEntry(entry.id)"
            />
          </draggable>
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
import { mapState, mapActions } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import { ACL_USER } from '~/helpers/pages-acls.js';
import { IS_ADMIN, USER } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import {
  DELIVERABILITY,
  FETCH_AUDIT,
  FETCH_INVENTORY_ITEMS,
  FETCH_MAPPING,
  CREATE_MAPPING_GROUP,
  UPDATE_MAPPING_GROUP,
  DELETE_MAPPING_GROUP,
  CREATE_MAPPING_ENTRY,
  UPDATE_MAPPING_ENTRY,
  DELETE_MAPPING_ENTRY,
  REORDER_MAPPING_ENTRIES,
  REORDER_MAPPING_GROUPS,
} from '~/store/deliverability';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import MappingInventorySidebar from '~/components/deliverability/mapping/mapping-inventory-sidebar.vue';
import MappingGroup from '~/components/deliverability/mapping/mapping-group.vue';
import MappingCard from '~/components/deliverability/mapping/mapping-card.vue';

export default {
  name: 'PageMapping',
  components: {
    draggable,
    BsPageHeader,
    MappingInventorySidebar,
    MappingGroup,
    MappingCard,
  },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER, sidebarModule: 'deliverability' },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ store, params }) {
    const { auditId } = params;
    try {
      await Promise.all([
        store.dispatch(`${DELIVERABILITY}/${FETCH_AUDIT}`, auditId),
        store.dispatch(`${DELIVERABILITY}/${FETCH_INVENTORY_ITEMS}`, auditId),
        store.dispatch(`${DELIVERABILITY}/${FETCH_MAPPING}`, auditId),
      ]);
      return { auditId };
    } catch (err) {
      console.error('Error loading mapping:', err);
      return { auditId };
    }
  },
  data() {
    return {
      localGroups: [],
      localUngrouped: [],
      newEntryId: null,
    };
  },
  computed: {
    ...mapState(DELIVERABILITY, [
      'mappingGroups',
      'mappingEntries',
      'inventoryItems',
    ]),
    pageTitle() {
      return this.$t('deliverability.mapping.title');
    },
    inventoryMap() {
      const map = {};
      Object.values(this.inventoryItems).forEach((items) => {
        if (Array.isArray(items)) {
          items.forEach((item) => {
            map[item.id] = item;
          });
        }
      });
      return map;
    },
  },
  watch: {
    mappingGroups: {
      immediate: true,
      handler() {
        this.rebuildLocal();
      },
    },
    mappingEntries: {
      immediate: true,
      handler() {
        this.rebuildLocal();
      },
    },
  },
  methods: {
    ...mapActions(DELIVERABILITY, {
      fetchMapping: FETCH_MAPPING,
      createGroup: CREATE_MAPPING_GROUP,
      updateGroup: UPDATE_MAPPING_GROUP,
      deleteGroup: DELETE_MAPPING_GROUP,
      createEntry: CREATE_MAPPING_ENTRY,
      updateEntry: UPDATE_MAPPING_ENTRY,
      deleteEntry: DELETE_MAPPING_ENTRY,
      reorderEntries: REORDER_MAPPING_ENTRIES,
      reorderGroups: REORDER_MAPPING_GROUPS,
    }),

    rebuildLocal() {
      const sortedGroups = [...this.mappingGroups].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      this.localGroups = sortedGroups.map((g) => ({
        ...g,
        entries: this.mappingEntries
          .filter((e) => e.groupId === g.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));
      this.localUngrouped = this.mappingEntries
        .filter((e) => !e.groupId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async addGroup() {
      try {
        await this.createGroup({
          auditId: this.auditId,
          name: this.$t('deliverability.mapping.group.defaultName'),
        });
      } catch {
        this.showError();
      }
    },

    async addEntry(groupId) {
      try {
        const entry = await this.createEntry({
          auditId: this.auditId,
          groupId,
        });
        this.newEntryId = entry.id;
        setTimeout(() => {
          this.newEntryId = null;
        }, 100);
      } catch {
        this.showError();
      }
    },

    async onUpdateGroup({ groupId, field, value }) {
      try {
        await this.updateGroup({
          auditId: this.auditId,
          groupId,
          data: { [field]: value },
        });
      } catch {
        this.showError();
      }
    },

    async onDeleteGroup(groupId) {
      try {
        await this.deleteGroup({ auditId: this.auditId, groupId });
      } catch {
        this.showError();
      }
    },

    async onUpdateEntry({ entryId, field, value }) {
      try {
        await this.updateEntry({
          auditId: this.auditId,
          entryId,
          data: { [field]: value },
        });
      } catch {
        this.showError();
      }
    },

    async onDeleteEntry(entryId) {
      try {
        await this.deleteEntry({ auditId: this.auditId, entryId });
      } catch {
        this.showError();
      }
    },

    onUngroupedChanged(evt) {
      if (evt.added) {
        const entry = evt.added.element;
        this.onUpdateEntry({
          entryId: entry.id,
          field: 'groupId',
          value: null,
        });
      }
      this.saveUngroupedOrder();
    },

    onGroupEntriesChanged({ groupId, evt }) {
      if (evt.added) {
        const entry = evt.added.element;
        this.onUpdateEntry({
          entryId: entry.id,
          field: 'groupId',
          value: groupId,
        });
      }
      this.saveGroupOrder(groupId);
    },

    saveUngroupedOrder() {
      const updates = this.localUngrouped.map((e, i) => ({
        id: e.id,
        sortOrder: i,
      }));
      this.reorderEntries({ auditId: this.auditId, updates });
    },

    saveGroupOrder(groupId) {
      const group = this.localGroups.find((g) => g.id === groupId);
      if (!group) return;
      const updates = group.entries.map((e, i) => ({ id: e.id, sortOrder: i }));
      this.reorderEntries({ auditId: this.auditId, updates });
    },

    showError() {
      this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
        message: this.$t('deliverability.mapping.saveError'),
        color: 'error',
      });
    },

    async saveGroupsOrder() {
      const updates = this.localGroups.map((g, i) => ({
        id: g.id,
        sortOrder: i,
      }));
      await this.reorderGroups({ auditId: this.auditId, updates });
    },

    exportMarkdown() {
      const allEntries = [
        ...this.localGroups.flatMap((g) => g.entries || []),
        ...this.localUngrouped,
      ];

      const resolve = (id) => {
        const item = this.inventoryMap[id];
        return item ? item.value : '';
      };

      const resolveArray = (ids) =>
        (ids || []).map(resolve).filter(Boolean).join(', ');

      const headers = [
        'Ligne',
        'Plateforme',
        'Usage',
        'Domaines From',
        'IPs',
        'Mail-From',
        'Reply-To',
        'Tracking',
        'Hébergement',
        'Destinations',
        'Qualité',
        'Stratégie',
        'Statut',
      ];

      const rows = allEntries.map((entry) => {
        const platform = entry.platformId ? resolve(entry.platformId) : '';
        const usage = entry.usageId ? resolve(entry.usageId) : '';
        const name =
          entry.customName ||
          [
            platform,
            usage,
            resolveArray(entry.fromDomainIds ? [entry.fromDomainIds[0]] : []),
          ]
            .filter(Boolean)
            .join(' · ') ||
          'Sans titre';
        const statusMap = {
          EN_DISCUSSION: 'En discussion',
          CONFIRMED: 'Confirmé',
          REJECTED: 'Rejeté',
        };
        return [
          name,
          platform,
          usage,
          resolveArray(entry.fromDomainIds),
          resolveArray(entry.ipIds),
          resolveArray(entry.mailFromIds),
          resolveArray(entry.replyToIds),
          resolveArray(entry.trackingDomainIds),
          resolveArray(entry.hostingDomainIds),
          resolveArray(entry.linkDestinationDomainIds),
          entry.qualityScore || 0,
          entry.strategicScore || 0,
          statusMap[entry.status] || entry.status,
        ];
      });

      const sep = headers.map(() => '---');
      const tableRows = [headers, sep, ...rows]
        .map((row) => `| ${row.join(' | ')} |`)
        .join('\n');

      navigator.clipboard
        .writeText(tableRows)
        .then(() => {
          this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
            message: this.$t('deliverability.mapping.exportMarkdownSuccess'),
            color: 'success',
          });
        })
        .catch(() => {
          const el = document.createElement('textarea');
          el.value = tableRows;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        });
    },
  },
};
</script>

<style scoped>
.mapping-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: all var(--t-fast);
}

.toolbar-btn--primary {
  background: #00acdc;
  color: white;
}

.toolbar-btn--primary:hover {
  background: #0891b2;
}

.toolbar-btn--secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.toolbar-btn--secondary:hover {
  background: var(--gray-200);
}

.toolbar-btn--sm {
  padding: 5px 10px;
  font-size: 12px;
}

.mapping-layout {
  display: flex;
  flex: 1;
  align-items: flex-start;
}

.mapping-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--gray-200);
  background: var(--white);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  top: 0;
  max-height: 100vh;
}

.mapping-main {
  flex: 1;
  min-width: 0;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mapping-canvas__ungrouped {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
}

.mapping-canvas__item {
  /* ensure each card/group is a block */
}

.mapping-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  color: var(--gray-400);
  gap: 12px;
  padding: 60px 24px;
}

.mapping-empty h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-600);
  margin: 0;
}

.mapping-empty p {
  font-size: 14px;
  margin: 0;
  max-width: 360px;
  line-height: 1.5;
}

.card-ghost {
  opacity: 0.4;
  background: rgba(0, 172, 220, 0.05);
  border: 1px dashed #00acdc !important;
}

.group-ghost {
  opacity: 0.4;
  background: rgba(0, 172, 220, 0.05);
  border: 1px dashed #00acdc !important;
}

@media (max-width: 900px) {
  .mapping-layout {
    flex-direction: column;
  }

  .mapping-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--gray-200);
    max-height: 250px;
  }
}
</style>
