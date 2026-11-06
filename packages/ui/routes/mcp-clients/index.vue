<script>
import { mapMutations } from 'vuex';
import { Plus, Trash2 } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsModalCreateMcpClient from '~/components/mcp-clients/modal-create-mcp-client.vue';
import BsMcpClientSettings from '~/components/mcp-clients/mcp-client-settings.vue';

// The assistants that cannot register themselves (Copilot Studio in manual
// mode) are given a client id and a secret here (ADR 0012).
export default {
  name: 'PageMcpClients',
  components: {
    BsPageHeader,
    BsModalConfirm,
    BsModalCreateMcpClient,
    BsMcpClientSettings,
    LucidePlus: Plus,
    LucideTrash2: Trash2,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_PLATFORM_MANAGE,
    sidebarModule: 'settings',
  },
  async asyncData({ $axios }) {
    try {
      const { items } = await $axios.$get(apiRoutes.mcpClients());
      return { clients: items, loadError: false };
    } catch (error) {
      console.error(error);
      return { clients: [], loadError: true };
    }
  },
  data() {
    return {
      clients: [],
      loadError: false,
      modalLoading: false,
      created: null,
      showCreated: false,
      toDelete: null,
      origin: '',
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$t('mcpClients.pageTitle');
    },
    headers() {
      return [
        { text: this.$t('mcpClients.name'), value: 'name' },
        { text: this.$t('mcpClients.settings.clientId'), value: 'clientId' },
        { text: this.$t('mcpClients.redirectUris'), value: 'redirectUris' },
        { text: this.$t('mcpClients.authMethod'), value: 'authMethod' },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        { text: '', value: 'actions', sortable: false, align: 'end' },
      ];
    },
  },
  mounted() {
    this.origin = window.location.origin;
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    formatDate(date) {
      return date ? new Date(date).toLocaleDateString(this.$i18n.locale) : '';
    },
    openCreateModal() {
      this.$refs.createModal.open();
    },
    async createClient(fields) {
      try {
        this.modalLoading = true;
        const { clientSecret, ...client } = await this.$axios.$post(
          apiRoutes.mcpClients(),
          fields
        );
        this.clients = [client, ...this.clients];
        this.$refs.createModal.close();
        // The secret is shown once, here, and kept nowhere in the page.
        this.created = { ...client, clientSecret };
        this.showCreated = true;
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.modalLoading = false;
      }
    },
    closeCreated() {
      this.showCreated = false;
      this.created = null;
    },
    askDelete(client) {
      this.toDelete = client;
      this.$refs.deleteModal.open();
    },
    async deleteClient() {
      const client = this.toDelete;
      try {
        await this.$axios.$delete(
          apiRoutes.mcpClientsItem({ clientId: client.clientId })
        );
        this.clients = this.clients.filter(
          (candidate) => candidate.clientId !== client.clientId
        );
        this.showSnackbar({
          text: this.$t('mcpClients.deleted'),
          color: 'success',
        });
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.toDelete = null;
      }
    },
    notifyError(error) {
      this.showSnackbar({
        text:
          error?.response?.data?.message ||
          this.$t('global.errors.errorOccured'),
        color: 'error',
      });
      console.error(error);
    },
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ title }}
      </template>
      <template #actions>
        <v-btn
          color="accent"
          elevation="0"
          :disabled="loadError"
          @click="openCreateModal"
        >
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('mcpClients.add') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid>
      <p class="text-body-2 text--secondary">
        {{ $t('mcpClients.description') }}
      </p>
      <v-alert v-if="loadError" type="error" outlined text>
        {{ $t('mcpClients.loadError') }}
      </v-alert>
      <v-data-table
        :headers="headers"
        :items="clients"
        item-key="clientId"
        :no-data-text="$t('mcpClients.empty')"
        hide-default-footer
        disable-pagination
      >
        <template #item.clientId="{ item }">
          <code class="bs-mcp-clients__id">{{ item.clientId }}</code>
        </template>
        <template #item.redirectUris="{ item }">
          <div v-for="uri in item.redirectUris" :key="uri">{{ uri }}</div>
        </template>
        <template #item.authMethod="{ item }">
          {{ $t(`mcpClients.authMethods.${item.tokenEndpointAuthMethod}`) }}
        </template>
        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
        <template #item.actions="{ item }">
          <v-btn
            icon
            small
            color="error"
            :aria-label="$t('global.delete')"
            @click="askDelete(item)"
          >
            <lucide-trash-2 :size="18" />
          </v-btn>
        </template>
      </v-data-table>

      <h2 class="text-subtitle-1 mt-8 mb-2">
        {{ $t('mcpClients.serverTitle') }}
      </h2>
      <p class="text-body-2 text--secondary">
        {{ $t('mcpClients.serverDescription') }}
      </p>
      <bs-mcp-client-settings v-if="origin" :origin="origin" />

      <bs-modal-create-mcp-client
        ref="createModal"
        :loading="modalLoading"
        @submit="createClient"
      />
      <v-dialog
        :value="showCreated"
        width="640"
        persistent
        @keydown.esc="closeCreated"
      >
        <v-card v-if="created" flat tile>
          <v-card-title>
            {{ $t('mcpClients.createdTitle', { name: created.name }) }}
          </v-card-title>
          <v-card-text>
            <v-alert type="warning" outlined text dense>
              {{ $t('mcpClients.secretOnce') }}
            </v-alert>
            <bs-mcp-client-settings :origin="origin" :client="created" />
          </v-card-text>
          <v-divider />
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" elevation="0" @click="closeCreated">
              {{ $t('mcpClients.secretSaved') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <bs-modal-confirm
        ref="deleteModal"
        :title="$t('mcpClients.deleteTitle')"
        :action-label="$t('global.delete')"
        @confirm="deleteClient"
      >
        <p v-if="toDelete">
          {{ $t('mcpClients.deleteConfirm', { name: toDelete.name }) }}
        </p>
      </bs-modal-confirm>
    </v-container>
  </div>
</template>

<style lang="scss" scoped>
.bs-mcp-clients__id {
  background: transparent;
  padding: 0;
  overflow-wrap: anywhere;
}
</style>
