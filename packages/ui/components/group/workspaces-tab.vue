<script>
import { groupsWorkspaces, deleteWorkspace } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import BsModalConfirmForm from '~/components/modal-confirm-form';

export default {
  name: 'BsGroupWorkspacesTab',
  components: {
    BsModalConfirmForm,
  },
  data() {
    return {
      workspaces: [],
      dialogDelete: false,
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
          text: this.$t('tableHeaders.workspaces.delete'),
          value: 'actionDelete',
          align: 'center',
          sortable: false,
        },
      ];
    },
  },
  watch: {
    dialogDelete(val) {
      val || this.closeDelete();
    },
    goToWorkspace(workspace) {
      const { groupId } = this.$route.params;
      this.$router.push(`/groups/${groupId}/workspace/${workspace.id}`);
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
          id: workspace.id,
          name: workspace.name,
          users: workspace?._users?.length,
          createdAt: moment(workspace.createdAt).format(DATE_FORMAT),
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
    closeDelete() {
      this.dialogDelete = false;
    },
    deleteItem(item) {
      this.$refs.deleteDialog.open(item);
    },
    async deleteWorkspace(selectedWorkspace) {
      try {
        console.log({ selectedWorkspace });
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
  <v-card flat tile>
    <v-card-text>
      <v-card elevation="2">
        <v-skeleton-loader v-if="loading" :loading="loading" type="table" />
        <bs-modal-confirm-form
          ref="deleteDialog"
          :title="`${$t('global.delete')} ?`"
          :action-label="$t('global.delete')"
          :confirmation-input-label="
            $t('groups.workspaceTab.confirmationField')
          "
          @confirm="deleteWorkspace"
        >
          <v-alert prominent type="error">
            {{ $t('groups.workspaceTab.deleteNotice') }}
          </v-alert>
        </bs-modal-confirm-form>
        <v-data-table
          v-show="!loading"
          :loading="loading"
          :headers="tableHeaders"
          :items="workspaces"
          @click:row="goToWorkspace"
        >
          <template #item.actionDelete="{ item }">
            <v-btn
              icon
              class="mx-2"
              small
              @click="deleteItem({ name: item.name, id: item.id })"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>
