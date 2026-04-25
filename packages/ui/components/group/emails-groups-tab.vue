<script>
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { getGroupEmailsGroups, getEmailsGroup } from '~/helpers/api-routes.js';
import BsModalConfirm from '~/components/modal-confirm';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { Trash2 } from 'lucide-vue';

export default {
  name: 'BsEmailGroupTab',
  components: {
    BsModalConfirm,
    BsDataTable,
    LucideTrash2: Trash2,
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
::v-deep .v-data-table tbody td:nth-child(2) {
  color: rgba(0, 0, 0, 0.7) !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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
