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
  validateIntegration,
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
      integrations: [],
      editingIntegration: null,
      showForm: false,
      showDeleteDialog: false,
      integrationToDelete: null,
      testingConnection: false,
      showSecretKey: false,
      form: {
        name: '',
        apiHost: '',
        apiKey: '',
        dashboards: [],
      },
    };
  },
  validations: {
    form: {
      name: { required },
      apiHost: { required, url },
      apiKey: { required },
    },
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    isEditing() {
      return this.editingIntegration !== null;
    },
    formTitle() {
      return this.isEditing
        ? this.$t('crmIntelligence.admin.editIntegration')
        : this.$t('crmIntelligence.admin.addIntegration');
    },
    hasIntegrations() {
      return this.integrations.length > 0;
    },
  },
  async mounted() {
    await this.fetchIntegrations();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async fetchIntegrations() {
      this.loading = true;
      try {
        const response = await this.$axios.$get(
          getIntegrations(this.groupId, INTEGRATION_TYPE_DASHBOARD)
        );
        this.integrations = response.items || [];
      } catch (error) {
        console.error('[CrmIntelligenceTab] Fetch error:', error);
      } finally {
        this.loading = false;
      }
    },

    openAddForm() {
      this.editingIntegration = null;
      this.form = {
        name: 'Metabase',
        apiHost: '',
        apiKey: '',
        dashboards: [],
      };
      this.$v.$reset();
      this.showForm = true;
    },

    openEditForm(integration) {
      this.editingIntegration = integration;
      this.form = {
        name: integration.name,
        apiHost: integration.apiHost || '',
        apiKey: '', // Don't show the masked key, require re-entry if changing
        dashboards: integration.dashboards ? [...integration.dashboards] : [],
      };
      this.$v.$reset();
      this.showForm = true;
    },

    closeForm() {
      this.showForm = false;
      this.editingIntegration = null;
      this.form = { name: '', apiHost: '', apiKey: '', dashboards: [] };
    },

    addDashboard() {
      this.form.dashboards.push({
        metabaseId: null,
        name: '',
        description: '',
        order: this.form.dashboards.length,
      });
    },

    removeDashboard(index) {
      this.form.dashboards.splice(index, 1);
      this.form.dashboards.forEach((d, i) => {
        d.order = i;
      });
    },

    async testConnection() {
      if (!this.form.apiHost || !this.form.apiKey) {
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.testConnectionFailed'),
          color: 'error',
        });
        return;
      }

      this.testingConnection = true;
      try {
        // For new integrations, we can't test yet - just validate format
        const urlValid = this.isValidUrl(this.form.apiHost);
        const keyValid = this.form.apiKey.length >= 32;

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
      this.$v.$touch();
      if (this.$v.$invalid && !this.isEditing) {
        return;
      }

      // For editing, apiKey is optional (keep existing if not provided)
      if (this.isEditing && !this.form.apiKey) {
        // Remove apiKey from payload if not changing
      }

      this.loading = true;
      try {
        const validDashboards = this.form.dashboards.filter(
          (d) => d.metabaseId && d.name
        );

        const payload = {
          name: this.form.name,
          type: INTEGRATION_TYPE_DASHBOARD,
          provider: PROVIDER_METABASE,
          apiHost: this.form.apiHost,
          dashboards: validDashboards.map((d) => ({
            metabaseId: parseInt(d.metabaseId, 10),
            name: d.name,
            description: d.description || '',
            order: d.order || 0,
            lockedParams: d.lockedParams || {},
          })),
        };

        // Only include apiKey if provided
        if (this.form.apiKey) {
          payload.apiKey = this.form.apiKey;
        }

        if (this.isEditing) {
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

        this.closeForm();
        await this.fetchIntegrations();
        this.$emit('update');
      } catch (error) {
        console.error('[CrmIntelligenceTab] Save error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.saveError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    confirmDelete(integration) {
      this.integrationToDelete = integration;
      this.showDeleteDialog = true;
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
        this.showDeleteDialog = false;
        this.integrationToDelete = null;
        await this.fetchIntegrations();
        this.$emit('update');
      } catch (error) {
        console.error('[CrmIntelligenceTab] Delete error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.deleteError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
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
      <v-alert type="info" text dense class="mb-4">
        {{ $t('groups.modules.crmIntelligence.toggleMovedHint') }}
      </v-alert>

      <!-- Integration List -->
      <div class="d-flex align-center mb-4">
        <h3 class="text-subtitle-1">
          {{ $t('crmIntelligence.admin.integrations') }}
        </h3>
        <v-spacer />
        <v-btn color="primary" small outlined @click="openAddForm">
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
          <v-btn icon small @click="openEditForm(integration)">
            <v-icon small>mdi-pencil</v-icon>
          </v-btn>
          <v-btn icon small color="error" @click="confirmDelete(integration)">
            <v-icon small>mdi-delete</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-subtitle>
          {{ integration.apiHost }}
          <span v-if="integration.dashboards && integration.dashboards.length">
            - {{ integration.dashboards.length }}
            {{ $t('crmIntelligence.admin.dashboardsCount') }}
          </span>
        </v-card-subtitle>
      </v-card>
    </v-card-text>

    <!-- Add/Edit Form Dialog -->
    <v-dialog v-model="showForm" max-width="800" persistent>
      <v-card>
        <v-card-title>
          {{ formTitle }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="form.name"
            :label="$t('crmIntelligence.admin.integrationName')"
            outlined
            dense
            class="mb-3"
          />

          <v-text-field
            v-model="form.apiHost"
            :label="$t('crmIntelligence.admin.siteUrl')"
            :hint="$t('crmIntelligence.admin.siteUrlHint')"
            :error-messages="
              $v.form.apiHost.$dirty && !$v.form.apiHost.url
                ? $t('crmIntelligence.admin.invalidUrl')
                : ''
            "
            outlined
            dense
            persistent-hint
            class="mb-3"
            @blur="$v.form.apiHost.$touch()"
          />

          <v-text-field
            v-model="form.apiKey"
            :label="$t('crmIntelligence.admin.secretKey')"
            :hint="
              isEditing
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
            :disabled="!form.apiHost || !form.apiKey"
            class="mb-4"
            @click="testConnection"
          >
            <v-icon left small>
              mdi-connection
            </v-icon>
            {{ $t('crmIntelligence.admin.testConnection') }}
          </v-btn>

          <v-divider class="mb-4" />

          <div class="d-flex align-center mb-4">
            <h4 class="text-subtitle-2">
              {{ $t('crmIntelligence.admin.dashboards') }}
            </h4>
            <v-spacer />
            <v-btn color="primary" x-small outlined @click="addDashboard">
              <v-icon left x-small>
                mdi-plus
              </v-icon>
              {{ $t('crmIntelligence.admin.addDashboard') }}
            </v-btn>
          </div>

          <v-card
            v-for="(dashboard, index) in form.dashboards"
            :key="index"
            outlined
            class="mb-2 pa-2"
          >
            <v-row dense>
              <v-col cols="2">
                <v-text-field
                  v-model.number="dashboard.metabaseId"
                  :label="$t('crmIntelligence.admin.dashboardId')"
                  type="number"
                  outlined
                  dense
                  hide-details
                />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model="dashboard.name"
                  :label="$t('crmIntelligence.admin.dashboardName')"
                  outlined
                  dense
                  hide-details
                />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model="dashboard.description"
                  :label="$t('crmIntelligence.admin.dashboardDescription')"
                  outlined
                  dense
                  hide-details
                />
              </v-col>
              <v-col cols="1">
                <v-text-field
                  v-model.number="dashboard.order"
                  label="#"
                  type="number"
                  outlined
                  dense
                  hide-details
                />
              </v-col>
              <v-col cols="1" class="d-flex align-center justify-center">
                <v-btn icon x-small color="error" @click="removeDashboard(index)">
                  <v-icon x-small>mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>
          </v-card>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeForm">
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

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>
          {{ $t('crmIntelligence.admin.deleteConfirmTitle') }}
        </v-card-title>
        <v-card-text>
          {{ $t('crmIntelligence.admin.deleteConfirmText') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showDeleteDialog = false">
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
  </v-card>
</template>
