<script>
import { validationMixin } from 'vuelidate';
import { required, url } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import {
  getIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  getDashboards,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  reorderDashboards,
} from '~/helpers/api-routes';

const INTEGRATION_TYPE_DASHBOARD = 'dashboard';
const PROVIDER_METABASE = 'metabase';

export default {
  name: 'BsCrmIntelligenceTab',
  mixins: [validationMixin],
  props: {
    group: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      loading: false,
      // Integrations
      integrations: [],
      editingIntegration: null,
      showIntegrationForm: false,
      showDeleteIntegrationDialog: false,
      integrationToDelete: null,
      testingConnection: false,
      showSecretKey: false,
      integrationForm: {
        name: '',
        apiHost: '',
        apiKey: '',
      },
      // Dashboards
      dashboards: [],
      editingDashboard: null,
      showDashboardForm: false,
      showDeleteDashboardDialog: false,
      dashboardToDelete: null,
      dashboardForm: {
        name: '',
        description: '',
        integrationId: null,
        providerDashboardId: null,
      },
    };
  },
  validations: {
    integrationForm: {
      name: { required },
      apiHost: { required, url },
      apiKey: { required },
    },
    dashboardForm: {
      name: { required },
      integrationId: { required },
      providerDashboardId: { required },
    },
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    isEditingIntegration() {
      return this.editingIntegration !== null;
    },
    isEditingDashboard() {
      return this.editingDashboard !== null;
    },
    integrationFormTitle() {
      return this.isEditingIntegration
        ? this.$t('crmIntelligence.admin.editIntegration')
        : this.$t('crmIntelligence.admin.addIntegration');
    },
    dashboardFormTitle() {
      return this.isEditingDashboard
        ? this.$t('crmIntelligence.admin.editDashboard')
        : this.$t('crmIntelligence.admin.addDashboard');
    },
    hasIntegrations() {
      return this.integrations.length > 0;
    },
    hasDashboards() {
      return this.dashboards.length > 0;
    },
  },
  async mounted() {
    await this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async fetchData() {
      this.loading = true;
      try {
        await Promise.all([this.fetchIntegrations(), this.fetchDashboards()]);
      } finally {
        this.loading = false;
      }
    },

    async fetchIntegrations() {
      try {
        const response = await this.$axios.$get(
          getIntegrations(this.groupId, INTEGRATION_TYPE_DASHBOARD)
        );
        this.integrations = response.items || [];
      } catch (error) {
        console.error('[CrmIntelligenceTab] Fetch integrations error:', error);
      }
    },

    async fetchDashboards() {
      try {
        const response = await this.$axios.$get(getDashboards(this.groupId));
        this.dashboards = response.items || [];
      } catch (error) {
        console.error('[CrmIntelligenceTab] Fetch dashboards error:', error);
      }
    },

    // ==================
    // Integration methods
    // ==================
    openAddIntegrationForm() {
      this.editingIntegration = null;
      this.integrationForm = {
        name: 'Metabase',
        apiHost: '',
        apiKey: '',
      };
      this.$v.integrationForm.$reset();
      this.showIntegrationForm = true;
    },

    openEditIntegrationForm(integration) {
      this.editingIntegration = integration;
      this.integrationForm = {
        name: integration.name,
        apiHost: integration.apiHost || '',
        apiKey: '',
      };
      this.$v.integrationForm.$reset();
      this.showIntegrationForm = true;
    },

    closeIntegrationForm() {
      this.showIntegrationForm = false;
      this.editingIntegration = null;
      this.integrationForm = { name: '', apiHost: '', apiKey: '' };
    },

    async testConnection() {
      if (!this.integrationForm.apiHost || !this.integrationForm.apiKey) {
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.testConnectionFailed'),
          color: 'error',
        });
        return;
      }

      this.testingConnection = true;
      try {
        const urlValid = this.isValidUrl(this.integrationForm.apiHost);
        const keyValid = this.integrationForm.apiKey.length >= 32;

        if (urlValid && keyValid) {
          this.showSnackbar({
            text: this.$t('crmIntelligence.admin.testConnectionSuccess'),
            color: 'success',
          });
        } else {
          this.showSnackbar({
            text: this.$t('crmIntelligence.admin.testConnectionFailed'),
            color: 'error',
          });
        }
      } finally {
        this.testingConnection = false;
      }
    },

    isValidUrl(string) {
      try {
        new URL(string);
        return true;
      } catch {
        return false;
      }
    },

    async saveIntegration() {
      this.$v.integrationForm.$touch();
      if (this.$v.integrationForm.$invalid && !this.isEditingIntegration) {
        return;
      }

      this.loading = true;
      try {
        const payload = {
          name: this.integrationForm.name,
          type: INTEGRATION_TYPE_DASHBOARD,
          provider: PROVIDER_METABASE,
          apiHost: this.integrationForm.apiHost,
        };

        if (this.integrationForm.apiKey) {
          payload.apiKey = this.integrationForm.apiKey;
        }

        if (this.isEditingIntegration) {
          await this.$axios.$put(
            updateIntegration(this.editingIntegration.id),
            payload
          );
          this.showSnackbar({
            text: this.$t('crmIntelligence.admin.saveSuccess'),
            color: 'success',
          });
        } else {
          await this.$axios.$post(createIntegration(this.groupId), payload);
          this.showSnackbar({
            text: this.$t('crmIntelligence.admin.createSuccess'),
            color: 'success',
          });
        }

        this.closeIntegrationForm();
        await this.fetchIntegrations();
        this.$emit('update');
      } catch (error) {
        console.error('[CrmIntelligenceTab] Save integration error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.saveError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    confirmDeleteIntegration(integration) {
      this.integrationToDelete = integration;
      this.showDeleteIntegrationDialog = true;
    },

    async deleteIntegrationConfirmed() {
      if (!this.integrationToDelete) return;

      this.loading = true;
      try {
        await this.$axios.$delete(
          deleteIntegration(this.integrationToDelete.id)
        );
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.deleteSuccess'),
          color: 'success',
        });
        this.showDeleteIntegrationDialog = false;
        this.integrationToDelete = null;
        await this.fetchData();
        this.$emit('update');
      } catch (error) {
        console.error('[CrmIntelligenceTab] Delete integration error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.deleteError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    // ==================
    // Dashboard methods
    // ==================
    openAddDashboardForm() {
      this.editingDashboard = null;
      this.dashboardForm = {
        name: '',
        description: '',
        integrationId: this.integrations.length === 1 ? this.integrations[0].id : null,
        providerDashboardId: null,
      };
      this.$v.dashboardForm.$reset();
      this.showDashboardForm = true;
    },

    openEditDashboardForm(dashboard) {
      this.editingDashboard = dashboard;
      this.dashboardForm = {
        name: dashboard.name,
        description: dashboard.description || '',
        integrationId: dashboard.integration && dashboard.integration.id ? dashboard.integration.id : null,
        providerDashboardId: dashboard.providerDashboardId,
      };
      this.$v.dashboardForm.$reset();
      this.showDashboardForm = true;
    },

    closeDashboardForm() {
      this.showDashboardForm = false;
      this.editingDashboard = null;
      this.dashboardForm = {
        name: '',
        description: '',
        integrationId: null,
        providerDashboardId: null,
      };
    },

    async saveDashboard() {
      this.$v.dashboardForm.$touch();
      if (this.$v.dashboardForm.$invalid) {
        return;
      }

      this.loading = true;
      try {
        const payload = {
          name: this.dashboardForm.name,
          description: this.dashboardForm.description,
          integrationId: this.dashboardForm.integrationId,
          providerDashboardId: parseInt(this.dashboardForm.providerDashboardId, 10),
        };

        if (this.isEditingDashboard) {
          await this.$axios.$put(
            updateDashboard(this.editingDashboard.id),
            payload
          );
          this.showSnackbar({
            text: this.$t('crmIntelligence.admin.dashboardSaveSuccess'),
            color: 'success',
          });
        } else {
          await this.$axios.$post(createDashboard(this.groupId), payload);
          this.showSnackbar({
            text: this.$t('crmIntelligence.admin.dashboardCreateSuccess'),
            color: 'success',
          });
        }

        this.closeDashboardForm();
        await this.fetchDashboards();
        this.$emit('update');
      } catch (error) {
        console.error('[CrmIntelligenceTab] Save dashboard error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.dashboardSaveError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    confirmDeleteDashboard(dashboard) {
      this.dashboardToDelete = dashboard;
      this.showDeleteDashboardDialog = true;
    },

    async deleteDashboardConfirmed() {
      if (!this.dashboardToDelete) return;

      this.loading = true;
      try {
        await this.$axios.$delete(deleteDashboard(this.dashboardToDelete.id));
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.dashboardDeleteSuccess'),
          color: 'success',
        });
        this.showDeleteDashboardDialog = false;
        this.dashboardToDelete = null;
        await this.fetchDashboards();
        this.$emit('update');
      } catch (error) {
        console.error('[CrmIntelligenceTab] Delete dashboard error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.dashboardDeleteError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    async moveDashboard(dashboard, direction) {
      const currentIndex = this.dashboards.findIndex(
        (d) => d.id === dashboard.id
      );
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (newIndex < 0 || newIndex >= this.dashboards.length) return;

      // Swap in local array
      const dashboardsCopy = [...this.dashboards];
      [dashboardsCopy[currentIndex], dashboardsCopy[newIndex]] = [
        dashboardsCopy[newIndex],
        dashboardsCopy[currentIndex],
      ];

      // Get new order of IDs
      const dashboardIds = dashboardsCopy.map((d) => d.id);

      this.loading = true;
      try {
        await this.$axios.$put(reorderDashboards(this.groupId), {
          dashboardIds,
        });
        await this.fetchDashboards();
      } catch (error) {
        console.error('[CrmIntelligenceTab] Reorder error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.reorderError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    getIntegrationName(integrationId) {
      const integration = this.integrations.find((i) => i.id === integrationId);
      return integration ? integration.name : '-';
    },
  },
};
</script>

<template>
  <v-card flat>
    <v-card-title>
      <v-icon left color="primary">
        mdi-chart-areaspline
      </v-icon>
      {{ $t('crmIntelligence.admin.title') }}
    </v-card-title>
    <v-card-subtitle>
      {{ $t('crmIntelligence.admin.description') }}
    </v-card-subtitle>

    <v-card-text>
      <v-alert type="info" text dense class="mb-6">
        {{ $t('groups.modules.crmIntelligence.toggleMovedHint') }}
      </v-alert>

      <!-- ==================== -->
      <!-- SECTION 1: INTEGRATIONS -->
      <!-- ==================== -->
      <div class="section-header mb-4">
        <h3 class="text-h6">
          <v-icon left small>
            mdi-connection
          </v-icon>
          {{ $t('crmIntelligence.admin.integrationsSection') }}
        </h3>
        <p class="text-body-2 grey--text mb-0">
          {{ $t('crmIntelligence.admin.integrationsSectionHint') }}
        </p>
      </div>

      <div class="d-flex align-center mb-4">
        <v-spacer />
        <v-btn color="primary" small outlined @click="openAddIntegrationForm">
          <v-icon left small>
            mdi-plus
          </v-icon>
          {{ $t('crmIntelligence.admin.addIntegration') }}
        </v-btn>
      </div>

      <v-alert v-if="!hasIntegrations && !loading" type="info" text dense>
        {{ $t('crmIntelligence.admin.noIntegrations') }}
      </v-alert>

      <v-card
        v-for="integration in integrations"
        :key="integration.id"
        outlined
        class="mb-3"
      >
        <v-card-title class="py-2">
          <v-icon left small color="primary">
            mdi-database
          </v-icon>
          {{ integration.name }}
          <v-chip small class="ml-2" color="secondary" outlined>
            {{ integration.provider }}
          </v-chip>
          <v-spacer />
          <v-btn icon small @click="openEditIntegrationForm(integration)">
            <v-icon small>
              mdi-pencil
            </v-icon>
          </v-btn>
          <v-btn
            icon
            small
            color="error"
            @click="confirmDeleteIntegration(integration)"
          >
            <v-icon small>
              mdi-delete
            </v-icon>
          </v-btn>
        </v-card-title>
        <v-card-subtitle>
          {{ integration.apiHost }}
        </v-card-subtitle>
      </v-card>

      <v-divider class="my-6" />

      <!-- ==================== -->
      <!-- SECTION 2: DASHBOARDS -->
      <!-- ==================== -->
      <div class="section-header mb-4">
        <h3 class="text-h6">
          <v-icon left small>
            mdi-view-dashboard
          </v-icon>
          {{ $t('crmIntelligence.admin.dashboardsSection') }}
        </h3>
        <p class="text-body-2 grey--text mb-0">
          {{ $t('crmIntelligence.admin.dashboardsSectionHint') }}
        </p>
      </div>

      <div class="d-flex align-center mb-4">
        <v-spacer />
        <v-btn
          color="primary"
          small
          outlined
          :disabled="!hasIntegrations"
          @click="openAddDashboardForm"
        >
          <v-icon left small>
            mdi-plus
          </v-icon>
          {{ $t('crmIntelligence.admin.addDashboard') }}
        </v-btn>
      </div>

      <v-alert v-if="!hasIntegrations && !loading" type="warning" text dense>
        {{ $t('crmIntelligence.admin.noIntegrationsForDashboards') }}
      </v-alert>

      <v-alert
        v-else-if="!hasDashboards && !loading"
        type="info"
        text
        dense
      >
        {{ $t('crmIntelligence.admin.noDashboards') }}
      </v-alert>

      <v-card
        v-for="(dashboard, index) in dashboards"
        :key="dashboard.id"
        outlined
        class="mb-2"
      >
        <v-card-title class="py-2">
          <span class="text-body-2 grey--text mr-3">#{{ index + 1 }}</span>
          <v-icon left small color="primary">
            mdi-chart-bar
          </v-icon>
          {{ dashboard.name }}
          <v-spacer />
          <v-btn
            icon
            x-small
            :disabled="index === 0"
            @click="moveDashboard(dashboard, 'up')"
          >
            <v-icon x-small>
              mdi-arrow-up
            </v-icon>
          </v-btn>
          <v-btn
            icon
            x-small
            :disabled="index === dashboards.length - 1"
            @click="moveDashboard(dashboard, 'down')"
          >
            <v-icon x-small>
              mdi-arrow-down
            </v-icon>
          </v-btn>
          <v-btn icon small class="ml-2" @click="openEditDashboardForm(dashboard)">
            <v-icon small>
              mdi-pencil
            </v-icon>
          </v-btn>
          <v-btn
            icon
            small
            color="error"
            @click="confirmDeleteDashboard(dashboard)"
          >
            <v-icon small>
              mdi-delete
            </v-icon>
          </v-btn>
        </v-card-title>
        <v-card-subtitle>
          <v-chip x-small outlined class="mr-2">
            {{ dashboard.integration && dashboard.integration.name ? dashboard.integration.name : '-' }}
          </v-chip>
          ID: {{ dashboard.providerDashboardId }}
          <span v-if="dashboard.description" class="ml-2">
            - {{ dashboard.description }}
          </span>
        </v-card-subtitle>
      </v-card>
    </v-card-text>

    <!-- ==================== -->
    <!-- Integration Form Dialog -->
    <!-- ==================== -->
    <v-dialog v-model="showIntegrationForm" max-width="600" persistent>
      <v-card>
        <v-card-title>
          {{ integrationFormTitle }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="integrationForm.name"
            :label="$t('crmIntelligence.admin.integrationName')"
            outlined
            dense
            class="mb-3"
          />

          <v-text-field
            v-model="integrationForm.apiHost"
            :label="$t('crmIntelligence.admin.siteUrl')"
            :hint="$t('crmIntelligence.admin.siteUrlHint')"
            :error-messages="
              $v.integrationForm.apiHost.$dirty &&
              !$v.integrationForm.apiHost.url
                ? $t('crmIntelligence.admin.invalidUrl')
                : ''
            "
            outlined
            dense
            persistent-hint
            class="mb-3"
            @blur="$v.integrationForm.apiHost.$touch()"
          />

          <v-text-field
            v-model="integrationForm.apiKey"
            :label="$t('crmIntelligence.admin.secretKey')"
            :hint="
              isEditingIntegration
                ? $t('crmIntelligence.admin.secretKeyHintEdit')
                : $t('crmIntelligence.admin.secretKeyHint')
            "
            :type="showSecretKey ? 'text' : 'password'"
            :append-icon="showSecretKey ? 'mdi-eye' : 'mdi-eye-off'"
            outlined
            dense
            persistent-hint
            class="mb-3"
            @click:append="showSecretKey = !showSecretKey"
          />

          <v-btn
            color="secondary"
            outlined
            small
            :loading="testingConnection"
            :disabled="!integrationForm.apiHost || !integrationForm.apiKey"
            @click="testConnection"
          >
            <v-icon left small>
              mdi-connection
            </v-icon>
            {{ $t('crmIntelligence.admin.testConnection') }}
          </v-btn>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeIntegrationForm">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn color="accent" :loading="loading" @click="saveIntegration">
            <v-icon left>
              mdi-content-save
            </v-icon>
            {{ $t('global.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==================== -->
    <!-- Dashboard Form Dialog -->
    <!-- ==================== -->
    <v-dialog v-model="showDashboardForm" max-width="600" persistent>
      <v-card>
        <v-card-title>
          {{ dashboardFormTitle }}
        </v-card-title>
        <v-card-text>
          <v-select
            v-model="dashboardForm.integrationId"
            :items="integrations"
            :label="$t('crmIntelligence.admin.selectIntegration')"
            item-text="name"
            item-value="id"
            outlined
            dense
            class="mb-3"
            :error-messages="
              $v.dashboardForm.integrationId.$dirty &&
              !$v.dashboardForm.integrationId.required
                ? $t('crmIntelligence.admin.integrationRequired')
                : ''
            "
          >
            <template v-slot:item="{ item }">
              <v-list-item-content>
                <v-list-item-title>{{ item.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.apiHost }}</v-list-item-subtitle>
              </v-list-item-content>
            </template>
          </v-select>

          <v-text-field
            v-model.number="dashboardForm.providerDashboardId"
            :label="$t('crmIntelligence.admin.dashboardId')"
            :hint="$t('crmIntelligence.admin.dashboardIdHint')"
            type="number"
            outlined
            dense
            persistent-hint
            class="mb-3"
            :error-messages="
              $v.dashboardForm.providerDashboardId.$dirty &&
              !$v.dashboardForm.providerDashboardId.required
                ? $t('crmIntelligence.admin.dashboardIdRequired')
                : ''
            "
          />

          <v-text-field
            v-model="dashboardForm.name"
            :label="$t('crmIntelligence.admin.dashboardName')"
            outlined
            dense
            class="mb-3"
            :error-messages="
              $v.dashboardForm.name.$dirty && !$v.dashboardForm.name.required
                ? $t('crmIntelligence.admin.dashboardNameRequired')
                : ''
            "
          />

          <v-textarea
            v-model="dashboardForm.description"
            :label="$t('crmIntelligence.admin.dashboardDescription')"
            outlined
            dense
            rows="2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeDashboardForm">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn color="accent" :loading="loading" @click="saveDashboard">
            <v-icon left>
              mdi-content-save
            </v-icon>
            {{ $t('global.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==================== -->
    <!-- Delete Integration Dialog -->
    <!-- ==================== -->
    <v-dialog v-model="showDeleteIntegrationDialog" max-width="400">
      <v-card>
        <v-card-title>
          {{ $t('crmIntelligence.admin.deleteIntegrationConfirmTitle') }}
        </v-card-title>
        <v-card-text>
          {{ $t('crmIntelligence.admin.deleteIntegrationConfirmText') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showDeleteIntegrationDialog = false">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="loading"
            @click="deleteIntegrationConfirmed"
          >
            {{ $t('global.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==================== -->
    <!-- Delete Dashboard Dialog -->
    <!-- ==================== -->
    <v-dialog v-model="showDeleteDashboardDialog" max-width="400">
      <v-card>
        <v-card-title>
          {{ $t('crmIntelligence.admin.deleteDashboardConfirmTitle') }}
        </v-card-title>
        <v-card-text>
          {{ $t('crmIntelligence.admin.deleteDashboardConfirmText') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showDeleteDashboardDialog = false">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="loading"
            @click="deleteDashboardConfirmed"
          >
            {{ $t('global.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.section-header {
  border-left: 4px solid var(--v-primary-base);
  padding-left: 12px;
}
</style>
