<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
import {
  getProviderLabel,
  getProviderCategory,
} from '~/components/integrations/provider-configs';
import BsIntegrationForm from '~/components/integrations/integration-form.vue';
import {
  Plus,
  Puzzle,
  CheckCircle2,
  XCircle,
  Cable,
  Pencil,
  Trash2,
  BarChart3,
  Bot,
  Languages,
} from 'lucide-vue';

// Icon mapping from Lucide icon names to components
const CATEGORY_ICON_MAP = {
  'bar-chart-3': BarChart3,
  'bot': Bot,
  'languages': Languages,
  'puzzle': Puzzle,
};

export default {
  name: 'BsGroupIntegrationsTab',
  components: {
    BsIntegrationForm,
    LucidePlus: Plus,
    LucidePuzzle: Puzzle,
    LucideCheckCircle2: CheckCircle2,
    LucideXCircle: XCircle,
    LucideCable: Cable,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
    LucideBarChart3: BarChart3,
    LucideBot: Bot,
    LucideLanguages: Languages,
  },
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
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
            apiRoutes.integrationsItem(this.editingIntegration._id),
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
          apiRoutes.integrationDashboardCount(integration._id)
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
          apiRoutes.integrationsItem(this.deletingIntegration._id)
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
        this.$set(this.validating, integration._id, true);
        const result = await this.$axios.$post(
          apiRoutes.integrationsValidate(integration._id)
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
        this.$set(this.validating, integration._id, false);
      }
    },

    getProviderLabel,

    getCategoryLabel(provider) {
      const category = getProviderCategory(provider);
      if (!category) return '-';
      return this.$t(category.labelKey);
    },

    getCategoryIconComponent(provider) {
      const category = getProviderCategory(provider);
      const iconName = category?.icon || 'puzzle';
      return CATEGORY_ICON_MAP[iconName] || Puzzle;
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
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('integrations.add') }}
        </v-btn>
      </div>

      <v-skeleton-loader v-if="loading && !integrations.length" type="table" />

      <v-data-table
        v-show="!loading || integrations.length"
        :loading="loading"
        :headers="tableHeaders"
        :items="integrations"
        :items-per-page="25"
        :hide-default-footer="integrations.length <= $options.TABLE_PAGINATION_THRESHOLD"
        :footer-props="$options.TABLE_FOOTER_PROPS"
        class="integrations-table"
      >
        <template #item.name="{ item }">
          <span class="font-weight-medium">{{ item.name }}</span>
        </template>

        <template #item.provider="{ item }">
          <div class="d-flex align-center">
            <component
              :is="getCategoryIconComponent(item.provider)"
              :size="16"
              class="mr-2 text--secondary"
            />
            <span class="mr-2">{{ getProviderLabel(item.provider) }}</span>
            <v-chip x-small outlined color="grey">
              {{ getCategoryLabel(item.provider) }}
            </v-chip>
          </div>
        </template>

        <template #item.validationStatus="{ item }">
          <v-chip
            small
            :color="getStatusColor(item.validationStatus)"
            :outlined="item.validationStatus !== 'valid'"
            :dark="item.validationStatus === 'valid'"
          >
            {{ getStatusLabel(item.validationStatus) }}
          </v-chip>
        </template>

        <template #item.isActive="{ item }">
          <v-chip
            small
            :color="item.isActive ? 'success' : 'grey'"
            :outlined="!item.isActive"
            :dark="item.isActive"
          >
            {{ item.isActive ? $t('global.enabled') : $t('global.disabled') }}
          </v-chip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex align-center">
            <v-tooltip bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  :loading="validating[item._id]"
                  v-bind="attrs"
                  v-on="on"
                  @click.stop="validateIntegration(item)"
                >
                  <lucide-cable :size="18" />
                </v-btn>
              </template>
              <span>{{ $t('integrations.validate') }}</span>
            </v-tooltip>
            <v-tooltip bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  v-bind="attrs"
                  v-on="on"
                  @click.stop="openEditForm(item)"
                >
                  <lucide-pencil :size="18" />
                </v-btn>
              </template>
              <span>{{ $t('global.edit') }}</span>
            </v-tooltip>
            <v-tooltip bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  v-bind="attrs"
                  v-on="on"
                  @click.stop="confirmDelete(item)"
                >
                  <lucide-trash2 :size="18" class="error--text" />
                </v-btn>
              </template>
              <span>{{ $t('global.delete') }}</span>
            </v-tooltip>
          </div>
        </template>

        <template #no-data>
          <div class="text-center pa-6">
            <lucide-puzzle :size="48" class="grey--text text--lighten-1" />
            <p class="text-body-1 grey--text mt-4">
              {{ $t('integrations.noIntegrations') }}
            </p>
          </div>
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
              <strong>{{ $t('integrations.deleteWarningDashboards', { count: deletingDashboardCount }) }}</strong>
            </v-alert>
          </v-card-text>
          <v-divider />
          <div class="modal-actions">
            <v-btn text color="primary" @click="showDeleteDialog = false">
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
          </div>
        </v-card>
      </v-dialog>
    </v-card-text>
  </v-card>
</template>

<style lang="scss" scoped>
.integrations-table {
  ::v-deep tbody tr {
    cursor: pointer;

    &:hover {
      background-color: rgba(0, 172, 220, 0.05) !important;
    }
  }
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
}
</style>
