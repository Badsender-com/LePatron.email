<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsIntegrationForm from '~/components/integrations/integration-form.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';

export default {
  name: 'BsGroupIntegrationsTab',
  components: {
    BsIntegrationForm,
    BsModalConfirm,
  },
  data() {
    return {
      loading: false,
      integrations: [],
      providers: [],
      types: [],
      showForm: false,
      editingIntegration: null,
      deletingIntegration: null,
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

    confirmDelete(integration) {
      this.deletingIntegration = integration;
      this.$refs.deleteDialog.open();
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
        this.deletingIntegration = null;
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

    getProviderLabel(provider) {
      const labels = {
        openai: 'OpenAI',
        mistral: 'Mistral AI',
      };
      return labels[provider] || provider;
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
        <v-btn color="primary" @click="openCreateForm">
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
          <v-chip small outlined>
            {{ getProviderLabel(item.provider) }}
          </v-chip>
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
            :loading="validating[item._id]"
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

      <!-- Delete Confirmation -->
      <bs-modal-confirm
        ref="deleteDialog"
        :title="$t('integrations.deleteConfirmTitle')"
        :message="
          $t('integrations.deleteConfirmMessage', {
            name: deletingIntegration && deletingIntegration.name,
          })
        "
        @confirm="deleteIntegration"
      />
    </v-card-text>
  </v-card>
</template>
