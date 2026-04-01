<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import {
  integrations,
  getDashboards,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  reorderDashboards,
} from '~/helpers/api-routes';
import {
  ArrowRight,
  Plus,
  LineChart,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Save,
} from 'lucide-vue';

const INTEGRATION_TYPE_DASHBOARD = 'dashboard';

export default {
  name: 'BsCrmIntelligenceTab',
  components: {
    LucideArrowRight: ArrowRight,
    LucidePlus: Plus,
    LucideLineChart: LineChart,
    LucideArrowUp: ArrowUp,
    LucideArrowDown: ArrowDown,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
    LucideSave: Save,
  },
  mixins: [validationMixin],
  props: {
    group: {
      type: Object,
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      loading: false,
      // Integrations (read-only, for dashboard select)
      integrations: [],
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
    isEditingDashboard() {
      return this.editingDashboard !== null;
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
  watch: {
    // Refresh data when tab becomes active (after adding integrations in another tab)
    active(isActive) {
      if (isActive) {
        this.fetchData();
      }
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
          integrations(this.groupId, INTEGRATION_TYPE_DASHBOARD)
        );
        this.integrations = response.items || [];
      } catch (error) {
        this.showSnackbar({
          text: this.$t('crmIntelligence.errors.fetchIntegrationsFailed'),
          color: 'error',
        });
      }
    },

    async fetchDashboards() {
      try {
        const response = await this.$axios.$get(getDashboards(this.groupId));
        this.dashboards = response.items || [];
      } catch (error) {
        this.showSnackbar({
          text: this.$t('crmIntelligence.errors.fetchDashboardsFailed'),
          color: 'error',
        });
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
        const errorCode = error.response?.data?.code;
        let errorMessage = this.$t('crmIntelligence.admin.dashboardSaveError');
        if (errorCode === 'DASHBOARD_ALREADY_EXISTS') {
          errorMessage = this.$t('crmIntelligence.errors.dashboardAlreadyExists');
        }
        this.showSnackbar({
          text: errorMessage,
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
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.reorderError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    goToIntegrationsTab() {
      // Emit event to parent to change tab
      this.$emit('change-tab', 'group-integrations');
    },
  },
};
</script>

<template>
  <v-card flat>
    <v-card-text>
      <!-- Info alert about Metabase configuration (only when no integrations) -->
      <v-alert v-if="!hasIntegrations" type="info" text dense class="mb-4">
        <div class="d-flex align-center">
          <span>{{ $t('crmIntelligence.admin.metabaseConfigHint') }}</span>
          <v-btn
            text
            small
            color="primary"
            class="ml-2"
            @click="goToIntegrationsTab"
          >
            {{ $t('crmIntelligence.admin.goToIntegrations') }}
            <lucide-arrow-right :size="16" class="ml-1" />
          </v-btn>
        </div>
      </v-alert>

      <div class="d-flex align-center mb-4">
        <v-spacer />
        <v-btn
          color="accent"
          small
          elevation="0"
          :disabled="!hasIntegrations"
          @click="openAddDashboardForm"
        >
          <lucide-plus :size="16" class="mr-1" />
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
          <lucide-line-chart :size="16" color="#00acdc" class="mr-2" />
          {{ dashboard.name }}
          <v-spacer />
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                small
                :disabled="index === 0"
                v-bind="attrs"
                v-on="on"
                @click="moveDashboard(dashboard, 'up')"
              >
                <lucide-arrow-up :size="16" />
              </v-btn>
            </template>
            <span>{{ $t('crmIntelligence.admin.moveUp') }}</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                small
                :disabled="index === dashboards.length - 1"
                v-bind="attrs"
                v-on="on"
                @click="moveDashboard(dashboard, 'down')"
              >
                <lucide-arrow-down :size="16" />
              </v-btn>
            </template>
            <span>{{ $t('crmIntelligence.admin.moveDown') }}</span>
          </v-tooltip>
          <v-btn icon small class="ml-2" @click="openEditDashboardForm(dashboard)">
            <lucide-pencil :size="16" />
          </v-btn>
          <v-btn
            icon
            small
            color="error"
            @click="confirmDeleteDashboard(dashboard)"
          >
            <lucide-trash2 :size="16" />
          </v-btn>
        </v-card-title>
        <v-card-subtitle>
          <v-chip x-small outlined class="mr-2">
            {{ dashboard.integration && dashboard.integration.name ? dashboard.integration.name : '-' }}
          </v-chip>
          <span v-if="dashboard.description">
            {{ dashboard.description }}
          </span>
        </v-card-subtitle>
      </v-card>
    </v-card-text>

    <!-- ==================== -->
    <!-- Dashboard Form Dialog -->
    <!-- ==================== -->
    <v-dialog v-model="showDashboardForm" max-width="600" persistent>
      <v-card>
        <v-card-title>
          {{ dashboardFormTitle }}
        </v-card-title>
        <v-card-text>
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
            class="mb-3"
          />

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
            :error-messages="
              $v.dashboardForm.providerDashboardId.$dirty &&
              !$v.dashboardForm.providerDashboardId.required
                ? $t('crmIntelligence.admin.dashboardIdRequired')
                : ''
            "
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeDashboardForm">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn color="accent" elevation="0" :loading="loading" @click="saveDashboard">
            <lucide-save :size="18" class="mr-2" />
            {{ $t('global.save') }}
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
            elevation="0"
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

