<script>
import { mapGetters, mapMutations } from 'vuex';
import { Plus, Trash2, KeyRound } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../../../shared/access/roles.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsModalCreateMcpClient from '~/components/mcp-clients/modal-create-mcp-client.vue';
import BsMcpClientSettings from '~/components/mcp-clients/mcp-client-settings.vue';

// The assistants that cannot register themselves (Copilot Studio in manual
// mode) are given a client id and a secret here, by the company's tech admin
// (ADR 0012): the company's users alone connect through them.
export default {
  name: 'PageMcpClients',
  components: {
    BsPageHeader,
    BsModalConfirm,
    BsModalCreateMcpClient,
    BsMcpClientSettings,
    LucidePlus: Plus,
    LucideTrash2: Trash2,
    LucideKeyRound: KeyRound,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: acls.ACL_GROUP_MANAGE_TECH,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    const fetched = await safeFetchGroup(nuxtContext);
    try {
      const { items } = await $axios.$get(
        apiRoutes.mcpClients({ groupId: params.groupId })
      );
      return { ...fetched, clients: items, loadError: false };
    } catch (error) {
      console.error(error);
      return { ...fetched, clients: [], loadError: true };
    }
  },
  data() {
    return {
      group: {},
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
    return { title: this.settingsTitle };
  },
  computed: {
    ...mapGetters(USER, { can: CAN }),
    showGroupBadge() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE) && this.group.name;
    },
    groupId() {
      return this.$route.params.groupId;
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
    openCreateModal() {
      this.$refs.createModal.open();
    },
    async createClient(fields) {
      try {
        this.modalLoading = true;
        const { clientSecret, ...client } = await this.$axios.$post(
          apiRoutes.mcpClients({ groupId: this.groupId }),
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
          apiRoutes.mcpClientsItem({
            groupId: this.groupId,
            clientId: client.clientId,
          })
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
      const code = error?.response?.data?.code;
      this.showSnackbar({
        text:
          code && this.$te(`mcpClients.errors.${code}`)
            ? this.$t(`mcpClients.errors.${code}`)
            : this.$t('global.errors.errorOccured'),
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
        {{ $t('mcpClients.pageTitle') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
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
      <v-alert
        v-if="group.id && group.enableMcp !== true"
        type="info"
        outlined
        text
      >
        {{ $t('mcpClients.mcpOff') }}
        <nuxt-link :to="`/groups/${groupId}/settings/ai-features`">
          {{ $t('aiFeatures.title') }}
        </nuxt-link>
      </v-alert>
      <v-alert v-if="loadError" type="error" outlined text>
        {{ $t('mcpClients.loadError') }}
      </v-alert>
      <v-data-table
        :headers="headers"
        :items="clients"
        item-key="clientId"
        hide-default-footer
        disable-pagination
      >
        <template #no-data>
          <div class="py-6 text--secondary">
            <lucide-key-round :size="32" class="mb-2" />
            <p class="mb-0">{{ $t('mcpClients.empty') }}</p>
          </div>
        </template>
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
          {{ item.createdAt | preciseDateTime($i18n.locale) }}
        </template>
        <template #item.actions="{ item }">
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                small
                color="error"
                :aria-label="$t('mcpClients.deleteNamed', { name: item.name })"
                v-bind="attrs"
                @click="askDelete(item)"
                v-on="on"
              >
                <lucide-trash-2 :size="18" />
              </v-btn>
            </template>
            <span>{{ $t('mcpClients.deleteNamed', { name: item.name }) }}</span>
          </v-tooltip>
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
      <!-- Closed only by its button: the secret is shown this once. -->
      <v-dialog :value="showCreated" width="640" persistent>
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
            <v-btn color="accent" elevation="0" @click="closeCreated">
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
