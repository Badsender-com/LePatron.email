<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
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

// Icon mapping from MDI to Lucide components
const CATEGORY_ICON_MAP = {
  'mdi-chart-bar': BarChart3,
  'mdi-robot': Bot,
  'mdi-translate': Languages,
  'mdi-puzzle': Puzzle,
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
      const iconName = category?.icon || 'mdi-puzzle';
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
        :no-data-text="$t('integrations.noIntegrations')"
      >
        <template #item.provider="{ item }">
          <div class="d-flex align-center">
            <component
              :is="getCategoryIconComponent(item.provider)"
              :size="16"
              class="mr-2"
              :title="getCategoryLabel(item.provider)"
            />
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
          <lucide-check-circle2 v-if="item.isActive" :size="20" color="#4caf50" />
          <lucide-x-circle v-else :size="20" color="#9e9e9e" />
        </template>

        <template #item.actions="{ item }">
          <v-btn
            icon
            small
            :loading="validating[item._id]"
            :title="$t('integrations.validate')"
            @click="validateIntegration(item)"
          >
            <lucide-cable :size="16" />
          </v-btn>
          <v-btn
            icon
            small
            :title="$t('global.edit')"
            @click="openEditForm(item)"
          >
            <lucide-pencil :size="16" />
          </v-btn>
          <v-btn
            icon
            small
            color="error"
            :title="$t('global.delete')"
            @click="confirmDelete(item)"
          >
            <lucide-trash2 :size="16" />
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
              <strong>{{ $t('integrations.deleteWarningDashboards', { count: deletingDashboardCount }) }}</strong>
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
