<script>
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import { Pencil, Trash2, Send } from 'lucide-vue';

export default {
  name: 'BsProfilesTable',
  LucideSend: Send,
  components: {
    BsDataTable,
    BsModalConfirmForm,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
  },
  props: {
    profiles: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    groupId: { type: String, default: null },
  },
  data() {
    return {
      selectedProfile: {},
    };
  },
  computed: {
    tableHeaders() {
      return [
        {
          text: this.$t('profiles.name'),
          align: 'left',
          value: 'name',
        },
        {
          text: this.$t('profiles.type'),
          align: 'left',
          value: 'type',
        },
        {
          text: this.$t('profiles.createdAt'),
          align: 'left',
          value: 'createdAt',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
        },
      ];
    },
  },
  methods: {
    goToProfile(profile) {
      this.$router.push(`/groups/${this.groupId}/profiles/${profile.id}`);
    },
    openDeleteModal(profile = {}) {
      this.selectedProfile = profile;
      this.$refs.deleteDialog.open({
        name: profile.name,
        id: profile.id,
      });
    },
    handleDelete() {
      this.$emit('delete', this.selectedProfile);
    },
  },
};
</script>

<template>
  <div>
    <bs-data-table
      :headers="tableHeaders"
      :items="profiles"
      :loading="loading"
      :empty-icon="$options.LucideSend"
      :empty-message="$t('profiles.emptyState')"
      clickable
      @click:row="goToProfile"
    >
      <template #item.name="{ item }">
        <span class="font-weight-medium">{{ item.name }}</span>
      </template>

      <template #item.type="{ item }">
        <v-chip small outlined>
          {{ item.type }}
        </v-chip>
      </template>

      <template #item.createdAt="{ item }">
        {{ item.createdAt | preciseDateTime }}
      </template>

      <template #item.actions="{ item }">
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              v-bind="attrs"
              v-on="on"
              @click.stop="goToProfile(item)"
            >
              <lucide-pencil :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.edit') }}</span>
        </v-tooltip>

        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              class="error--text"
              v-bind="attrs"
              v-on="on"
              @click.stop="openDeleteModal(item)"
            >
              <lucide-trash2 :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.delete') }}</span>
        </v-tooltip>
      </template>
    </bs-data-table>

    <bs-modal-confirm-form
      ref="deleteDialog"
      :title="`${$t('global.delete')} ?`"
      :action-label="$t('global.delete')"
      :with-input-confirmation="false"
      @confirm="handleDelete"
    >
      <p
        class="black--text"
        v-html="
          $t('profiles.deleteWarningMessage', {
            name: selectedProfile.name,
          })
        "
      />
    </bs-modal-confirm-form>
  </div>
</template>

<style lang="scss" scoped>
/* =========================================================================
   BsDataTable Styles — LePatron Design System v1.0
   ========================================================================= */

::v-deep .v-data-table thead th {
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: rgba(0, 0, 0, 0.6) !important;
  padding: 10px 16px !important;
  background: rgba(0, 0, 0, 0.02) !important;
  height: 40px !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
  white-space: nowrap;
  user-select: none;
}

::v-deep .v-data-table tbody tr {
  height: 40px !important;
  cursor: pointer;
  transition: background 0.15s ease-out;
}

::v-deep .v-data-table tbody td {
  padding: 10px 16px !important;
  font-size: 13px !important;
  color: rgba(0, 0, 0, 0.87) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
  height: 40px !important;
  vertical-align: middle;
}

::v-deep .v-data-table tbody tr:last-child td {
  border-bottom: none !important;
}

::v-deep .v-data-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected {
  background: rgba(0, 172, 220, 0.06) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected:hover {
  background: rgba(0, 172, 220, 0.1) !important;
}

::v-deep .v-data-table__empty-wrapper {
  padding: 48px 24px !important;
  text-align: center;
  color: rgba(0, 0, 0, 0.87) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

/* Name column - primary color */
::v-deep .v-data-table tbody td:nth-child(1) {
  font-weight: 500 !important;
  color: var(--v-primary-base) !important;
}

/* Date column - tabular nums */
::v-deep .v-data-table tbody td:nth-child(3) {
  color: rgba(0, 0, 0, 0.7) !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Chips - small style */
::v-deep .v-chip {
  font-size: 11px !important;
  height: 20px !important;
  padding: 0 8px !important;
  font-weight: 500 !important;
}

/* Actions column - right aligned */
::v-deep .v-data-table tbody td:last-child {
  text-align: right !important;
  width: 1%;
  white-space: nowrap;
}

::v-deep .v-data-table thead th:last-child {
  text-align: right !important;
  width: 1%;
}
</style>
