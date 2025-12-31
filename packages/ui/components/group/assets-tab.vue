<script>
import { groupAssets, groupAssetItem, groupAssetTestConnection } from '~/helpers/api-routes.js';
import { DATE_FORMAT } from '~/helpers/constants/date-formats.js';
import moment from 'moment';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import BsModalConfirmForm from '~/components/modal-confirm-form';

export default {
  name: 'BsGroupAssetsTab',
  components: {
    BsModalConfirmForm,
  },
  data() {
    return {
      assets: [],
      loading: false,
      selectedAsset: {},
      testingConnection: null,
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('assets.type'), align: 'center', value: 'type' },
        { text: this.$t('assets.publicEndpoint'), align: 'left', value: 'publicEndpoint' },
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
        const response = await this.$axios.$get(groupAssets({ groupId: this.groupId }));
        this.assets = (response?.result || []).map((asset) => ({
          ...asset,
          createdAt: moment(asset.createdAt).format(DATE_FORMAT),
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
    goToAsset(asset) {
      this.$router.push(`/groups/${this.groupId}/asset/${asset.id}`);
    },
    deleteItem(item) {
      this.selectedAsset = item;
      this.$refs.deleteDialog.open({ name: item.name, id: item.id });
    },
    async deleteAsset(selectedAsset) {
      try {
        await this.$axios.delete(groupAssetItem({ groupId: this.groupId, assetId: selectedAsset?.id }));
        await this.fetchData();
        this.showSnackbar({
          text: this.$t('assets.deleteSuccessful'),
          color: 'success',
        });
      } catch (error) {
        if (error.response?.data?.message === 'ASSET_IN_USE') {
          const profiles = error.response?.data?.exportProfiles || [];
          const profileNames = profiles.map((p) => p.name).join(', ');
          this.showSnackbar({
            text: this.$t('assets.inUseError', { profiles: profileNames }),
            color: 'error',
          });
        } else {
          this.showSnackbar({
            text: this.$t('global.errors.errorOccured'),
            color: 'error',
          });
        }
      }
    },
    async testConnection(asset) {
      this.testingConnection = asset.id;
      try {
        const response = await this.$axios.$post(groupAssetTestConnection({ groupId: this.groupId }), {
          assetId: asset.id,
        });
        if (response.success) {
          this.showSnackbar({
            text: this.$t('assets.connectionSuccess'),
            color: 'success',
          });
        } else {
          this.showSnackbar({
            text: this.$t('assets.connectionFailed', { message: response.message }),
            color: 'error',
          });
        }
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.testingConnection = null;
      }
    },
    async toggleActive(asset) {
      try {
        await this.$axios.put(groupAssetItem({ groupId: this.groupId, assetId: asset.id }), {
          isActive: !asset.isActive,
        });
        await this.fetchData();
        this.showSnackbar({
          text: this.$t('assets.statusUpdated'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    getTypeColor(type) {
      return type === 'sftp' ? 'blue' : 'orange';
    },
    getTypeLabel(type) {
      return type === 'sftp' ? 'SFTP' : 'S3';
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
          :confirmation-input-label="$t('assets.confirmationField')"
          :confirm-check-box="false"
          @confirm="deleteAsset"
        >
          <p
            class="black--text"
            v-html="$t('assets.deleteWarningMessage', { name: selectedAsset.name })"
          />
        </bs-modal-confirm-form>
        <v-data-table
          v-show="!loading"
          :loading="loading"
          :headers="tableHeaders"
          :items="assets"
          :no-data-text="$t('assets.emptyState')"
        >
          <template #item.name="{ item }">
            <nuxt-link :to="`/groups/${groupId}/asset/${item.id}`">
              {{ item.name }}
            </nuxt-link>
          </template>
          <template #item.type="{ item }">
            <v-chip small :color="getTypeColor(item.type)" text-color="white">
              {{ getTypeLabel(item.type) }}
            </v-chip>
          </template>
          <template #item.publicEndpoint="{ item }">
            <span class="text-truncate" style="max-width: 250px; display: inline-block;">
              {{ item.publicEndpoint }}
            </span>
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
              :loading="testingConnection === item.id"
              :title="$t('assets.testConnection')"
              @click.stop="testConnection(item)"
            >
              <v-icon small>mdi-connection</v-icon>
            </v-btn>
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
              :to="`/groups/${groupId}/asset/${item.id}`"
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
