<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import {
  getProviderLabel,
  getProviderCategory,
} from '~/components/integrations/provider-configs';
import BsIntegrationForm from '~/components/integrations/integration-form.vue';

export default {
  name: 'BsGroupIntegrationsTab',
  components: {
    BsIntegrationForm,
  },
  data() {
    return {
      loading: false,
      integrations: [],
      providers: [],
      types: [],
      showForm: false,
      showDeleteDialog: false,
      editingIntegration: null,
      deletingIntegration: null,
      deletingDashboardCount: 0,
      validating: {},
    };
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('integrations.name'), value: 'name' },
        { text: this.$t('integrations.provider'), value: 'provider' },
        { text: this.$t('integrations.status'), value: 'validationStatus' },
        { text: this.$t('integrations.active'), value: 'isActive' },
        { text: this.$t('global.actions'), value: 'actions', sortable: false },
      ];
    },
    groupId() {
      return this.$route.params.groupId;
    },
    formTitle() {
      return this.editingIntegration
        ? this.$t('integrations.edit')
        : this.$t('integrations.add');
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async fetchData() {
      try {
        this.loading = true;
        const [integrationsRes, providersRes] = await Promise.all([
          this.$axios.$get(apiRoutes.integrations(this.groupId)),
          this.$axios.$get(apiRoutes.integrationsProviders()),
        ]);
        this.integrations = integrationsRes.items || [];
        this.providers = providersRes.providers || [];
        this.types = providersRes.types || [];
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    openCreateForm() {
      this.editingIntegration = null;
      this.showForm = true;
    },

    openEditForm(integration) {
      this.editingIntegration = { ...integration };
      this.showForm = true;
    },

    closeForm() {
      this.showForm = false;
      this.editingIntegration = null;
    },

    async saveIntegration(data) {
      try {
        this.loading = true;
        if (this.editingIntegration) {
          await this.$axios.$put(
            apiRoutes.integrationsItem(this.editingIntegration.id),
            data
          );
          this.showSnackbar({
            text: this.$t('integrations.updated'),
            color: 'success',
          });
        } else {
          await this.$axios.$post(apiRoutes.integrations(this.groupId), data);
          this.showSnackbar({
            text: this.$t('integrations.created'),
            color: 'success',
          });
        }
        this.closeForm();
        await this.fetchData();
      } catch (error) {
        const errorResponse = error.response && error.response.data;
        const message =
          (errorResponse && errorResponse.message) ||
          this.$t('global.errors.errorOccured');
        this.showSnackbar({ text: message, color: 'error' });
      } finally {
        this.loading = false;
      }
    },

    async confirmDelete(integration) {
      this.deletingIntegration = integration;
      this.deletingDashboardCount = 0;

      // Fetch dashboard count to show warning if there are associated dashboards
      try {
        const result = await this.$axios.$get(
          apiRoutes.integrationDashboardCount(integration.id)
        );
        this.deletingDashboardCount = result.count || 0;
      } catch (error) {
        // Ignore error, just show standard delete confirmation
      }

      this.showDeleteDialog = true;
    },

    async deleteIntegration() {
      if (!this.deletingIntegration) return;
      try {
        this.loading = true;
        await this.$axios.$delete(
          apiRoutes.integrationsItem(this.deletingIntegration.id)
        );
        this.showSnackbar({
          text: this.$t('integrations.deleted'),
          color: 'success',
        });
        this.showDeleteDialog = false;
        this.deletingIntegration = null;
        this.deletingDashboardCount = 0;
        await this.fetchData();
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    async validateIntegration(integration) {
      try {
        this.$set(this.validating, integration.id, true);
        const result = await this.$axios.$post(
          apiRoutes.integrationsValidate(integration.id)
        );
        if (result.valid) {
          this.showSnackbar({
            text: this.$t('integrations.validationSuccess'),
            color: 'success',
          });
        } else {
          this.showSnackbar({
            text: this.$t('integrations.validationFailed'),
            color: 'error',
          });
        }
        await this.fetchData();
      } catch (error) {
        this.showSnackbar({
          text: this.$t('integrations.validationFailed'),
          color: 'error',
        });
      } finally {
        this.$set(this.validating, integration.id, false);
      }
    },

    getProviderLabel,

    getCategoryLabel(provider) {
      const category = getProviderCategory(provider);
      if (!category) return '-';
      return this.$t(category.labelKey);
    },

    getCategoryIcon(provider) {
      const category = getProviderCategory(provider);
      if (!category) return 'mdi-puzzle';
      return category.icon;
    },

    getStatusColor(status) {
      const colors = {
        valid: 'success',
        invalid: 'error',
        pending: 'warning',
      };
      return colors[status] || 'grey';
    },

    getStatusLabel(status) {
      return this.$t(`integrations.statusLabels.${status}`);
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <div class="d-flex justify-end mb-4">
        <v-btn color="accent" elevation="0" @click="openCreateForm">
          <v-icon left>
            mdi-plus
          </v-icon>
          {{ $t('integrations.add') }}
        </v-btn>
      </div>

      <v-skeleton-loader v-if="loading && !integrations.length" type="table" />

      <v-data-table
        v-show="!loading || integrations.length"
        :loading="loading"
        :headers="tableHeaders"
        :items="integrations"
        :no-data-text="$t('integrations.noIntegrations')"
      >
        <template #item.provider="{ item }">
          <div class="d-flex align-center">
            <v-icon small class="mr-2" :title="getCategoryLabel(item.provider)">
              {{ getCategoryIcon(item.provider) }}
            </v-icon>
            <span class="mr-2">{{ getProviderLabel(item.provider) }}</span>
            <v-chip x-small outlined color="grey">
              {{ getCategoryLabel(item.provider) }}
            </v-chip>
          </div>
        </template>

        <template #item.validationStatus="{ item }">
          <v-chip small :color="getStatusColor(item.validationStatus)">
            {{ getStatusLabel(item.validationStatus) }}
          </v-chip>
        </template>

        <template #item.isActive="{ item }">
          <v-icon :color="item.isActive ? 'success' : 'grey'">
            {{ item.isActive ? 'mdi-check-circle' : 'mdi-close-circle' }}
          </v-icon>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            icon
            small
            :loading="validating[item.id]"
            :title="$t('integrations.validate')"
            @click="validateIntegration(item)"
          >
            <v-icon small>
              mdi-connection
            </v-icon>
          </v-btn>
          <v-btn
            icon
            small
            :title="$t('global.edit')"
            @click="openEditForm(item)"
          >
            <v-icon small>
              mdi-pencil
            </v-icon>
          </v-btn>
          <v-btn
            icon
            small
            color="error"
            :title="$t('global.delete')"
            @click="confirmDelete(item)"
          >
            <v-icon small>
              mdi-delete
            </v-icon>
          </v-btn>
        </template>
      </v-data-table>

      <!-- Form Dialog -->
      <v-dialog v-model="showForm" max-width="600" persistent>
        <bs-integration-form
          :integration="editingIntegration"
          :providers="providers"
          :loading="loading"
          @save="saveIntegration"
          @cancel="closeForm"
        />
      </v-dialog>

      <!-- Delete Confirmation Dialog -->
      <v-dialog v-model="showDeleteDialog" max-width="500">
        <v-card>
          <v-card-title>
            {{ $t('integrations.deleteConfirmTitle') }}
          </v-card-title>
          <v-card-text>
            <p>
              {{
                $t('integrations.deleteConfirmMessage', {
                  name: deletingIntegration && deletingIntegration.name,
                })
              }}
            </p>
            <v-alert
              v-if="deletingDashboardCount > 0"
              type="warning"
              dense
              class="mt-4"
            >
              <strong>{{
                $t('integrations.deleteWarningDashboards', {
                  count: deletingDashboardCount,
                })
              }}</strong>
            </v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text @click="showDeleteDialog = false">
              {{ $t('global.cancel') }}
            </v-btn>
            <v-btn
              color="error"
              elevation="0"
              :loading="loading"
              @click="deleteIntegration"
            >
              {{ $t('global.delete') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card-text>
  </v-card>
</template>
