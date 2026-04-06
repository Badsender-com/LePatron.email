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
import BsModalConfirm from '~/components/modal-confirm';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import {
  ArrowRight,
  Plus,
  LayoutDashboard,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  LineChart,
} from 'lucide-vue';

const INTEGRATION_TYPE_DASHBOARD = 'dashboard';

export default {
  name: 'BsCrmIntelligenceTab',
  components: {
    BsModalConfirm,
    BsTextField,
    BsSelect,
    LucideArrowRight: ArrowRight,
    LucidePlus: Plus,
    LucideLayoutDashboard: LayoutDashboard,
    LucideArrowUp: ArrowUp,
    LucideArrowDown: ArrowDown,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
    LucideLineChart: LineChart,
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
    integrationItems() {
      return this.integrations.map((item) => ({
        value: item.id,
        text: item.name,
        subtitle: item.apiHost,
      }));
    },
    deleteDialogName() {
      return this.dashboardToDelete ? this.dashboardToDelete.name : '';
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.dashboardForm.name.$dirty) return errors;
      !this.$v.dashboardForm.name.required &&
        errors.push(this.$t('crmIntelligence.admin.dashboardNameRequired'));
      return errors;
    },
    integrationErrors() {
      const errors = [];
      if (!this.$v.dashboardForm.integrationId.$dirty) return errors;
      !this.$v.dashboardForm.integrationId.required &&
        errors.push(this.$t('crmIntelligence.admin.integrationRequired'));
      return errors;
    },
    dashboardIdErrors() {
      const errors = [];
      if (!this.$v.dashboardForm.providerDashboardId.$dirty) return errors;
      !this.$v.dashboardForm.providerDashboardId.required &&
        errors.push(this.$t('crmIntelligence.admin.dashboardIdRequired'));
      return errors;
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
        integrationId:
          this.integrations.length === 1 ? this.integrations[0].id : null,
        providerDashboardId: null,
      };
      this.$v.dashboardForm.$reset();
      this.$refs.dashboardFormDialog.open();
    },

    openEditDashboardForm(dashboard) {
      this.editingDashboard = dashboard;
      this.dashboardForm = {
        name: dashboard.name,
        description: dashboard.description || '',
        integrationId:
          dashboard.integration && dashboard.integration.id
            ? dashboard.integration.id
            : null,
        providerDashboardId: dashboard.providerDashboardId,
      };
      this.$v.dashboardForm.$reset();
      this.$refs.dashboardFormDialog.open();
    },

    closeDashboardForm() {
      this.$refs.dashboardFormDialog.close();
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
          providerDashboardId: parseInt(
            this.dashboardForm.providerDashboardId,
            10
          ),
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
          errorMessage = this.$t(
            'crmIntelligence.errors.dashboardAlreadyExists'
          );
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
      this.$refs.deleteDialog.open();
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
  <div class="crm-intelligence">
    <!-- Info alert about Metabase configuration (only when no integrations) -->
    <v-alert v-if="!hasIntegrations" type="info" text dense class="mb-4">
      <div class="d-flex align-center flex-wrap">
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

    <!-- Dashboards Table -->
    <div class="dashboards-table">
      <!-- Table Header -->
      <div class="dashboards-table__header">
        <div class="dashboards-table__col dashboards-table__col--order">#</div>
        <div class="dashboards-table__col dashboards-table__col--name">
          {{ $t('global.name') }}
        </div>
        <div class="dashboards-table__col dashboards-table__col--integration">
          {{ $t('crmIntelligence.admin.selectIntegration') }}
        </div>
        <div class="dashboards-table__col dashboards-table__col--actions">
          {{ $t('personalizedVariables.actions') }}
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !hasDashboards" class="dashboards-table__loading">
        <v-progress-circular indeterminate color="primary" size="32" />
      </div>

      <!-- Empty State: No Integrations -->
      <div
        v-else-if="!hasIntegrations && !loading"
        class="dashboards-table__empty"
      >
        <lucide-layout-dashboard
          :size="48"
          class="dashboards-table__empty-icon"
        />
        <p>{{ $t('crmIntelligence.admin.noIntegrationsForDashboards') }}</p>
      </div>

      <!-- Empty State: No Dashboards -->
      <div
        v-else-if="!hasDashboards && !loading"
        class="dashboards-table__empty"
      >
        <lucide-layout-dashboard
          :size="48"
          class="dashboards-table__empty-icon"
        />
        <p>{{ $t('crmIntelligence.admin.noDashboards') }}</p>
      </div>

      <!-- Table Rows -->
      <div
        v-for="(dashboard, index) in dashboards"
        v-else
        :key="dashboard.id"
        class="dashboards-table__row"
      >
        <div class="dashboards-table__col dashboards-table__col--order">
          <span class="dashboards-table__order">{{ index + 1 }}</span>
        </div>
        <div class="dashboards-table__col dashboards-table__col--name">
          <div class="dashboards-table__name-content">
            <lucide-line-chart :size="16" class="dashboards-table__icon" />
            <div>
              <div class="dashboards-table__name">
                {{ dashboard.name }}
              </div>
              <div v-if="dashboard.description" class="dashboards-table__desc">
                {{ dashboard.description }}
              </div>
            </div>
          </div>
        </div>
        <div class="dashboards-table__col dashboards-table__col--integration">
          <v-chip x-small outlined>
            {{
              dashboard.integration && dashboard.integration.name
                ? dashboard.integration.name
                : '-'
            }}
          </v-chip>
        </div>
        <div class="dashboards-table__col dashboards-table__col--actions">
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                x-small
                :disabled="index === 0 || loading"
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
                x-small
                :disabled="index === dashboards.length - 1 || loading"
                v-bind="attrs"
                v-on="on"
                @click="moveDashboard(dashboard, 'down')"
              >
                <lucide-arrow-down :size="16" />
              </v-btn>
            </template>
            <span>{{ $t('crmIntelligence.admin.moveDown') }}</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                x-small
                :disabled="loading"
                v-bind="attrs"
                v-on="on"
                @click="openEditDashboardForm(dashboard)"
              >
                <lucide-pencil :size="16" />
              </v-btn>
            </template>
            <span>{{ $t('global.edit') }}</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                x-small
                class="error--text"
                :disabled="loading"
                v-bind="attrs"
                v-on="on"
                @click="confirmDeleteDashboard(dashboard)"
              >
                <lucide-trash2 :size="16" />
              </v-btn>
            </template>
            <span>{{ $t('global.delete') }}</span>
          </v-tooltip>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <v-btn
        text
        color="primary"
        :disabled="!hasIntegrations || loading"
        @click="openAddDashboardForm"
      >
        <lucide-plus :size="16" class="mr-1" />
        {{ $t('crmIntelligence.admin.addDashboard') }}
      </v-btn>
    </div>

    <!-- ==================== -->
    <!-- Dashboard Form Dialog -->
    <!-- ==================== -->
    <bs-modal-confirm
      ref="dashboardFormDialog"
      :title="dashboardFormTitle"
      :is-form="true"
      modal-width="500"
    >
      <v-form @submit.prevent="saveDashboard">
        <bs-text-field
          v-model="dashboardForm.name"
          :label="$t('crmIntelligence.admin.dashboardName')"
          :error-messages="nameErrors"
          :disabled="loading"
          required
          autofocus
          @blur="$v.dashboardForm.name.$touch()"
        />

        <div class="bs-textarea" :class="{ 'bs-textarea--disabled': loading }">
          <label class="bs-textarea__label">
            {{ $t('crmIntelligence.admin.dashboardDescription') }}
          </label>
          <v-textarea
            v-model="dashboardForm.description"
            :placeholder="
              $t('crmIntelligence.admin.dashboardDescriptionPlaceholder')
            "
            :disabled="loading"
            rows="2"
            solo
            flat
            hide-details
            class="bs-textarea__input"
          />
        </div>

        <bs-select
          v-model="dashboardForm.integrationId"
          :label="$t('crmIntelligence.admin.selectIntegration')"
          :items="integrationItems"
          :error-messages="integrationErrors"
          :disabled="loading"
          required
          @blur="$v.dashboardForm.integrationId.$touch()"
        />

        <bs-text-field
          v-model.number="dashboardForm.providerDashboardId"
          :label="$t('crmIntelligence.admin.dashboardId')"
          :hint="$t('crmIntelligence.admin.dashboardIdHint')"
          :error-messages="dashboardIdErrors"
          :disabled="loading"
          type="number"
          required
          @blur="$v.dashboardForm.providerDashboardId.$touch()"
        />

        <v-divider class="mt-4" />
        <div class="modal-actions">
          <v-btn
            text
            color="primary"
            :disabled="loading"
            @click="closeDashboardForm"
          >
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn
            type="submit"
            color="accent"
            elevation="0"
            :loading="loading"
            :disabled="loading"
          >
            {{ $t('global.save') }}
          </v-btn>
        </div>
      </v-form>
    </bs-modal-confirm>

    <!-- ==================== -->
    <!-- Delete Dashboard Dialog -->
    <!-- ==================== -->
    <bs-modal-confirm
      ref="deleteDialog"
      :title="$t('crmIntelligence.admin.deleteDashboardConfirmTitle')"
      :action-label="$t('global.delete')"
      action-button-color="error"
      action-button-elevation="0"
      @confirm="deleteDashboardConfirmed"
    >
      <p>
        {{
          $t('crmIntelligence.admin.deleteDashboardConfirmTextWithName', {
            name: deleteDialogName,
          })
        }}
      </p>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
.crm-intelligence {
  max-width: 900px;
}

.dashboards-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;

  &__header {
    display: flex;
    align-items: center;
    background: #fafafa;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__row {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.02);
    }
  }

  &__col {
    &--order {
      width: 3rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &--name {
      flex: 2;
      padding-right: 1rem;
      min-width: 0;
    }

    &--integration {
      flex: 1;
      padding-right: 1rem;
    }

    &--actions {
      width: 8rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
    }
  }

  &__order {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.38);
    background: rgba(0, 0, 0, 0.04);
    border-radius: 50%;
  }

  &__name-content {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  &__icon {
    color: #00acdc;
    flex-shrink: 0;
    margin-top: 2px;
  }

  &__name {
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
  }

  &__desc {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.54);
    margin-top: 2px;
  }

  &__loading,
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: rgba(0, 0, 0, 0.38);
  }

  &__empty-icon {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  &__empty p {
    margin: 0;
    font-size: 0.875rem;
    text-align: center;
  }
}

.form-actions {
  display: flex;
  align-items: center;
  padding-top: 0.5rem;
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}

.bs-textarea {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__input {
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2) !important;
      border-radius: 4px;
      background: #fff !important;
      min-height: 40px;
      padding: 8px 12px;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4) !important;
      }
    }

    &.v-input--is-focused ::v-deep .v-input__slot {
      border-color: #00acdc !important;
    }

    ::v-deep textarea {
      font-size: 0.875rem;
      line-height: 1.5;

      &::placeholder {
        color: rgba(0, 0, 0, 0.38);
        font-size: 0.875rem;
      }
    }
  }

  &--disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}
</style>
