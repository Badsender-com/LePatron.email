<script>
import { groupsWorkspaces, deleteWorkspace } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import { Trash2, Pencil, Users } from 'lucide-vue';
import { escapeHtml } from '~/helpers/escape-html';

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
    escapeHtml,
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
            name: escapeHtml(selectedWorkspace.name),
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
        <nuxt-link
          :to="`/groups/${$route.params.groupId}/workspace/${item.id}`"
          class="cell-link font-weight-medium"
          @click.native.stop
        >
          {{ item.name }}
        </nuxt-link>
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
/* Real <nuxt-link> on the name cell so middle-click opens in a new tab. */
.cell-link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  border-radius: 2px;

  &:hover {
    text-decoration: underline;
    color: var(--v-primary-base);
  }
}
</style>
