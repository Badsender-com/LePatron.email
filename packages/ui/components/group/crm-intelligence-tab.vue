<script>
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
import BsDashboardCard from './dashboard-card.vue';
import BsDashboardFormDialog from './dashboard-form-dialog.vue';
import BsDashboardDeleteDialog from './dashboard-delete-dialog.vue';

const INTEGRATION_TYPE_DASHBOARD = 'dashboard';

export default {
  name: 'BsCrmIntelligenceTab',
  components: {
    BsDashboardCard,
    BsDashboardFormDialog,
    BsDashboardDeleteDialog,
  },
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
      integrations: [],
      dashboards: [],
      editingDashboard: null,
      showDashboardForm: false,
      showDeleteDashboardDialog: false,
      dashboardToDelete: null,
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    hasIntegrations() {
      return this.integrations.length > 0;
    },
    hasDashboards() {
      return this.dashboards.length > 0;
    },
  },
  watch: {
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
      } catch {
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
      } catch {
        this.showSnackbar({
          text: this.$t('crmIntelligence.errors.fetchDashboardsFailed'),
          color: 'error',
        });
      }
    },

    openAddDashboardForm() {
      this.editingDashboard = null;
      this.showDashboardForm = true;
    },

    openEditDashboardForm(dashboard) {
      this.editingDashboard = dashboard;
      this.showDashboardForm = true;
    },

    async saveDashboard(payload) {
      this.loading = true;
      try {
        if (this.editingDashboard) {
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

        this.showDashboardForm = false;
        this.editingDashboard = null;
        await this.fetchDashboards();
        this.$emit('update');
      } catch (error) {
        const errorCode =
          error.response && error.response.data
            ? error.response.data.code
            : null;
        let errorMessage = this.$t('crmIntelligence.admin.dashboardSaveError');
        if (errorCode === 'DASHBOARD_ALREADY_EXISTS') {
          errorMessage = this.$t(
            'crmIntelligence.errors.dashboardAlreadyExists'
          );
        }
        this.showSnackbar({ text: errorMessage, color: 'error' });
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
      } catch {
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

      const dashboardsCopy = [...this.dashboards];
      [dashboardsCopy[currentIndex], dashboardsCopy[newIndex]] = [
        dashboardsCopy[newIndex],
        dashboardsCopy[currentIndex],
      ];

      const dashboardIds = dashboardsCopy.map((d) => d.id);

      this.loading = true;
      try {
        await this.$axios.$put(reorderDashboards(this.groupId), {
          dashboardIds,
        });
        await this.fetchDashboards();
      } catch {
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.reorderError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    goToIntegrationsTab() {
      this.$emit('change-tab', 'group-integrations');
    },
  },
};
</script>

<template>
  <v-card flat>
    <v-card-text>
      <!-- Info alert about Metabase configuration (only when no integrations) -->
      <v-alert v-if="!hasIntegrations" type="info" outlined class="mb-4">
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
            <v-icon right small>
              mdi-arrow-right
            </v-icon>
          </v-btn>
        </div>
      </v-alert>

      <div class="d-flex justify-end mb-4">
        <v-btn
          color="accent"
          elevation="0"
          :disabled="!hasIntegrations"
          @click="openAddDashboardForm"
        >
          <v-icon left>
            mdi-plus
          </v-icon>
          {{ $t('crmIntelligence.admin.addDashboard') }}
        </v-btn>
      </div>

      <v-skeleton-loader v-if="loading && !hasDashboards" type="table" />

      <v-alert
        v-else-if="!hasDashboards && !loading"
        type="info"
        outlined
        class="mb-4"
      >
        {{ $t('crmIntelligence.admin.noDashboards') }}
      </v-alert>

      <bs-dashboard-card
        v-for="(dashboard, index) in dashboards"
        :key="dashboard.id"
        :dashboard="dashboard"
        :index="index"
        :is-first="index === 0"
        :is-last="index === dashboards.length - 1"
        @move="moveDashboard(dashboard, $event)"
        @edit="openEditDashboardForm(dashboard)"
        @delete="confirmDeleteDashboard(dashboard)"
      />
    </v-card-text>

    <!-- Dashboard Form Dialog -->
    <bs-dashboard-form-dialog
      v-model="showDashboardForm"
      :dashboard="editingDashboard"
      :integrations="integrations"
      :loading="loading"
      @save="saveDashboard"
    />

    <!-- Delete Dashboard Dialog -->
    <bs-dashboard-delete-dialog
      v-model="showDeleteDashboardDialog"
      :loading="loading"
      @confirm="deleteDashboardConfirmed"
    />
  </v-card>
</template>
