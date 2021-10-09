<script>
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { getEmailsGroups, getEmailsGroup } from '~/helpers/api-routes.js';
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'BsEmailGroupTab',
  components: {
    BsModalConfirm,
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
          text: this.$t('global.delete'),
          value: 'actionDelete',
          align: 'center',
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
      /* const {
        $axios,
        $route: { params },
      } = this; */
      const { $axios } = this;

      try {
        this.loading = true;
        const {
          data: { items: emailsGroups },
        } = await $axios.get(getEmailsGroups());

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
  <v-card flat tile>
    <v-card-text>
      <v-card elevation="2">
        <v-skeleton-loader v-if="loading" :loading="loading" type="table" />
        <v-data-table
          v-show="!loading"
          :loading="loading"
          :headers="tableHeaders"
          :items="emailsGroups"
          :no-data-text="$t('global.emailsGroupsEmpty')"
        >
          <template #item.name="{ item }">
            <nuxt-link
              :to="`/groups/${$route.params.groupId}/emails-groups/${item.id}`"
            >
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
    <bs-modal-confirm
      ref="deleteDialog"
      :title="`${$t('global.delete')} ${selectedEmailsGroup.name}?`"
      :action-label="$t('global.delete')"
      action-button-color="error"
      @confirm="deleteEmailsGroup"
    >
      {{ $t('forms.emailsGroup.deleteNotice') }}
    </bs-modal-confirm>
  </v-card>
</template>
