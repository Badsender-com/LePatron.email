<script>
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { getGroupEmailsGroups, getEmailsGroup } from '~/helpers/api-routes.js';
import BsModalConfirm from '~/components/modal-confirm';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsRowActions from '~/components/row-actions/BsRowActions.vue';
import { Pencil, Trash2 } from 'lucide-vue';

export default {
  name: 'BsEmailGroupTab',
  components: {
    BsModalConfirm,
    BsDataTable,
    BsRowActions,
  },
  data() {
    return {
      emailsGroups: [],
      selectedEmailsGroup: {},
      loading: false,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
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
        const {
          data: { items: emailsGroups },
        } = await $axios.get(getGroupEmailsGroups(params.groupId));

        this.emailsGroups = emailsGroups.map(({ createdAt, ...rest }) => ({
          ...rest,
          createdAt: moment(createdAt).format(DATE_FORMAT),
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
    goToEmailsGroup(item) {
      const { groupId } = this.$route.params;
      this.$router.push(`/groups/${groupId}/emails-groups/${item.id}`);
    },
    buildQuickActions(item) {
      return [
        {
          key: 'edit',
          icon: Pencil,
          text: 'global.edit',
          onClick: () => this.goToEmailsGroup(item),
        },
        {
          key: 'delete',
          icon: Trash2,
          text: 'global.delete',
          variant: 'danger',
          onClick: () => this.deleteItem(item),
        },
      ];
    },
    deleteItem(item) {
      this.selectedEmailsGroup = item;
      this.$refs.deleteDialog.open({ name: item.name, id: item.id });
    },
    async deleteEmailsGroup() {
      const { $axios } = this;
      try {
        const emailGroupResponse = await $axios.delete(
          getEmailsGroup(this.selectedEmailsGroup.id)
        );
        if (emailGroupResponse.status !== 204) {
          throw new Error();
        }
        await this.fetchData();

        this.showSnackbar({
          text: this.$t('forms.emailsGroup.deleteSuccess'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.$refs.deleteDialog.close();
    },
  },
};
</script>

<template>
  <div>
    <bs-data-table
      :headers="tableHeaders"
      :items="emailsGroups"
      :loading="loading"
      :empty-icon="$options.components.LucideMail"
      :empty-message="$t('global.emailsGroupsEmpty')"
      clickable
      @click:row="goToEmailsGroup"
    >
      <template #item.name="{ item }">
        <span class="font-weight-medium">{{ item.name }}</span>
      </template>

      <template #item.actions="{ item }">
        <bs-row-actions :quick-actions="buildQuickActions(item)" />
      </template>
    </bs-data-table>

    <bs-modal-confirm
      ref="deleteDialog"
      :title="`${$t('global.delete')}`"
      :action-label="$t('global.delete')"
      action-button-color="error"
      action-button-elevation="0"
      @confirm="deleteEmailsGroup"
    >
      {{ $t('forms.emailsGroup.deleteNotice') }}
    </bs-modal-confirm>
  </div>
</template>
