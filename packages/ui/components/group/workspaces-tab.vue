<script>
import { groupsWorkspaces, deleteWorkspace } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import { Trash2, Pencil, Users } from 'lucide-vue';

export default {
  name: 'BsGroupWorkspacesTab',
  components: {
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
      TABLE_FOOTER_PROPS,
      TABLE_PAGINATION_THRESHOLD,
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
          align: 'center',
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
    <v-skeleton-loader v-if="loading" type="table" />

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

    <v-data-table
      v-if="!loading"
      :headers="tableHeaders"
      :items="workspaces"
      :hide-default-footer="workspaces.length <= TABLE_PAGINATION_THRESHOLD"
      :footer-props="TABLE_FOOTER_PROPS"
      class="workspaces-table"
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

      <template #no-data>
        <div class="text-center pa-6">
          <lucide-users :size="48" class="grey--text text--lighten-1" />
          <p class="text-body-1 grey--text mt-4">
            {{ $t('groups.workspaceTab.empty') }}
          </p>
        </div>
      </template>
    </v-data-table>
  </div>
</template>

<style scoped>
.workspaces-table >>> tbody tr {
  cursor: pointer;
}

.workspaces-table >>> tbody tr:hover {
  background-color: rgba(0, 172, 220, 0.05);
}
</style>
