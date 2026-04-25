<script>
import { groupsWorkspaces, deleteWorkspace } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import { Trash2, Pencil, Users } from 'lucide-vue';

export default {
  name: 'BsGroupWorkspacesTab',
  components: {
    BsDataTable,
    BsModalConfirmForm,
    LucideTrash2: Trash2,
    LucidePencil: Pencil,
    LucideUsers: Users,
  },
  data() {
    return {
      workspaces: [],
      dialogDelete: false,
      selectedWorkspace: {},
      loading: false,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$tc('global.user', 2), align: 'left', value: 'users' },
        {
          text: this.$t('global.createdAt'),
          align: 'left',
          value: 'createdAt',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          align: 'right',
          sortable: false,
        },
      ];
    },
    confirmCheckBox() {
      return (
        !!this.selectedWorkspace?.folders || !!this.selectedWorkspace?.mails
      );
    },
  },
  watch: {
    dialogDelete(val) {
      val || this.closeDelete();
    },
  },
  async mounted() {
    await this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async fetchData() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        this.loading = true;
        const workspacesResponse = await $axios.$get(groupsWorkspaces(params));
        this.workspaces = workspacesResponse?.items?.map((workspace) => ({
          ...workspace,
          users: workspace?._users?.length,
          createdAt: moment(workspace.createdAt).format(DATE_FORMAT),
          folders: workspace?.folders?.length,
          mails: workspace?.mails?.length,
        }));
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
    goToWorkspace(workspace) {
      const { groupId } = this.$route.params;
      this.$router.push(`/groups/${groupId}/workspace/${workspace.id}`);
    },
    closeDelete() {
      this.dialogDelete = false;
    },
    deleteItem(item) {
      this.selectedWorkspace = item;
      this.$refs.deleteDialog.open({ name: item.name, id: item.id });
    },
    async deleteWorkspace(selectedWorkspace) {
      try {
        await this.$axios.delete(deleteWorkspace(selectedWorkspace?.id));
        await this.fetchData();
        this.showSnackbar({
          text: this.$t('groups.workspaceTab.deleteSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeDelete();
    },
  },
};
</script>

<template>
  <div>
    <bs-modal-confirm-form
      ref="deleteDialog"
      :title="`${$t('global.delete')} ?`"
      :action-label="$t('global.delete')"
      :confirmation-input-label="$t('groups.workspaceTab.confirmationField')"
      :confirm-check-box="confirmCheckBox"
      :confirm-check-box-message="$t('groups.workspaceTab.deleteNotice')"
      @confirm="deleteWorkspace"
    >
      <p
        class="black--text"
        v-html="
          $t('groups.workspaceTab.deleteWarningMessage', {
            name: selectedWorkspace.name,
          })
        "
      />
    </bs-modal-confirm-form>

    <bs-data-table
      :headers="tableHeaders"
      :items="workspaces"
      :loading="loading"
      :empty-icon="$options.components.LucideUsers"
      :empty-message="$t('groups.workspaceTab.empty')"
      clickable
      @click:row="goToWorkspace"
    >
      <template #item.name="{ item }">
        <span class="font-weight-medium">{{ item.name }}</span>
      </template>

      <template #item.users="{ item }">
        <v-chip small outlined>
          <lucide-users :size="14" class="mr-1" />
          {{ item.users || 0 }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              v-bind="attrs"
              v-on="on"
              @click.stop="goToWorkspace(item)"
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
              @click.stop="deleteItem(item)"
            >
              <lucide-trash2 :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('global.delete') }}</span>
        </v-tooltip>
      </template>
    </bs-data-table>
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
