<script>
import { groupExportProfiles, groupExportProfileItem } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import BsModalConfirmForm from '~/components/modal-confirm-form';

export default {
  name: 'BsGroupExportProfilesTab',
  components: {
    BsModalConfirmForm,
  },
  data() {
    return {
      exportProfiles: [],
      loading: false,
      selectedProfile: {},
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('exportProfiles.deliveryMethod'), align: 'center', value: 'deliveryMethod' },
        { text: this.$t('exportProfiles.espProfile'), align: 'left', value: 'espProfileName' },
        { text: this.$t('exportProfiles.assetMethod'), align: 'center', value: 'assetMethod' },
        { text: this.$t('exportProfiles.asset'), align: 'left', value: 'assetName' },
        { text: this.$t('global.status'), align: 'center', value: 'isActive' },
        { text: this.$t('global.createdAt'), align: 'left', value: 'createdAt' },
        { text: this.$t('global.actions'), value: 'actions', align: 'center', sortable: false },
      ];
    },
    groupId() {
      return this.$route.params.groupId;
    },
  },
  async mounted() {
    await this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async fetchData() {
      try {
        this.loading = true;
        const response = await this.$axios.$get(groupExportProfiles({ groupId: this.groupId }));
        this.exportProfiles = (response?.result || []).map((profile) => ({
          ...profile,
          createdAt: moment(profile.createdAt).format(DATE_FORMAT),
          espProfileName: profile._espProfile?.name || '-',
          assetName: profile._asset?.name || '-',
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
    goToExportProfile(profile) {
      this.$router.push(`/groups/${this.groupId}/export-profile/${profile.id}`);
    },
    deleteItem(item) {
      this.selectedProfile = item;
      this.$refs.deleteDialog.open({ name: item.name, id: item.id });
    },
    async deleteExportProfile(selectedProfile) {
      try {
        await this.$axios.delete(groupExportProfileItem({
          groupId: this.groupId,
          exportProfileId: selectedProfile?.id,
        }));
        await this.fetchData();
        this.showSnackbar({
          text: this.$t('exportProfiles.deleteSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    async toggleActive(profile) {
      try {
        await this.$axios.put(groupExportProfileItem({
          groupId: this.groupId,
          exportProfileId: profile.id,
        }), {
          isActive: !profile.isActive,
        });
        await this.fetchData();
        this.showSnackbar({
          text: this.$t('exportProfiles.statusUpdated'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    getDeliveryMethodColor(method) {
      return method === 'esp' ? 'purple' : 'teal';
    },
    getDeliveryMethodLabel(method) {
      return method === 'esp' ? this.$t('exportProfiles.viaEsp') : this.$t('exportProfiles.download');
    },
    getAssetMethodColor(method) {
      switch (method) {
        case 'asset':
          return 'blue';
        case 'zip':
          return 'green';
        case 'esp_api':
          return 'orange';
        default:
          return 'grey';
      }
    },
    getAssetMethodLabel(method) {
      switch (method) {
        case 'asset':
          return this.$t('exportProfiles.assetMethodAsset');
        case 'zip':
          return this.$t('exportProfiles.assetMethodZip');
        case 'esp_api':
          return this.$t('exportProfiles.assetMethodEspApi');
        default:
          return method;
      }
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <v-card flat tile>
        <v-skeleton-loader v-if="loading" :loading="loading" type="table" />
        <bs-modal-confirm-form
          ref="deleteDialog"
          :title="`${$t('global.delete')} ?`"
          :action-label="$t('global.delete')"
          :confirmation-input-label="$t('exportProfiles.confirmationField')"
          :confirm-check-box="false"
          @confirm="deleteExportProfile"
        >
          <p
            class="black--text"
            v-html="$t('exportProfiles.deleteWarningMessage', { name: selectedProfile.name })"
          />
        </bs-modal-confirm-form>
        <v-data-table
          v-show="!loading"
          :loading="loading"
          :headers="tableHeaders"
          :items="exportProfiles"
          :no-data-text="$t('exportProfiles.emptyState')"
        >
          <template #item.name="{ item }">
            <nuxt-link :to="`/groups/${groupId}/export-profile/${item.id}`">
              {{ item.name }}
            </nuxt-link>
          </template>
          <template #item.deliveryMethod="{ item }">
            <v-chip small :color="getDeliveryMethodColor(item.deliveryMethod)" text-color="white">
              {{ getDeliveryMethodLabel(item.deliveryMethod) }}
            </v-chip>
          </template>
          <template #item.assetMethod="{ item }">
            <v-chip small :color="getAssetMethodColor(item.assetMethod)" text-color="white">
              {{ getAssetMethodLabel(item.assetMethod) }}
            </v-chip>
          </template>
          <template #item.isActive="{ item }">
            <v-chip small :color="item.isActive ? 'success' : 'grey'" text-color="white">
              {{ item.isActive ? $t('global.active') : $t('global.inactive') }}
            </v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              icon
              small
              :title="item.isActive ? $t('global.deactivate') : $t('global.activate')"
              @click.stop="toggleActive(item)"
            >
              <v-icon small>{{ item.isActive ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
            </v-btn>
            <v-btn
              icon
              small
              :to="`/groups/${groupId}/export-profile/${item.id}`"
              :title="$t('global.edit')"
            >
              <v-icon small>mdi-pencil</v-icon>
            </v-btn>
            <v-btn
              icon
              small
              :title="$t('global.delete')"
              @click.stop="deleteItem(item)"
            >
              <v-icon small>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card>
    </v-card-text>
  </v-card>
</template>
