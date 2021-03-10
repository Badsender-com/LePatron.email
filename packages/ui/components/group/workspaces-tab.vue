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
          text: this.$t('global.delete'),
          value: 'actionDelete',
          align: 'center',
          sortable: false,
        },
      ];
    },
    confirmCheckBox() {
      return this.selectedWorkspace?.folders || this.selectedWorkspace?.mails;
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
          :confirm-check-box="confirmCheckBox"
          :confirm-check-box-message="$t('groups.workspaceTab.deleteNotice')"
          @confirm="deleteWorkspace"
        />
        <v-data-table
          v-show="!loading"
          :loading="loading"
          :headers="tableHeaders"
          :items="workspaces"
        >
          <template #item.name="{ item }">
            <nuxt-link :to="`/groups/${$route.params.groupId}/workspace/${item.id}`">
              {{ item.name }}
            </nuxt-link>
          </template>
          <template #item.actionDelete="{ item }">
            <v-btn icon class="mx-2" small @click.stop="deleteItem(item)">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>
