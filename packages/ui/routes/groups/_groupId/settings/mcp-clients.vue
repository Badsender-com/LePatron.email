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
import BsModalMcpClientSecret from '~/components/mcp-clients/modal-mcp-client-secret.vue';

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
    BsModalMcpClientSecret,
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
      // The client just created, its secret with it, for the dialog.
      created: null,
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
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.modalLoading = false;
      }
    },
    closeCreated() {
      this.created = null;
    },
    metaOf(client) {
      return this.$t('mcpClients.clientMeta', {
        authMethod: this.$t(
          `mcpClients.authMethods.${client.tokenEndpointAuthMethod}`
        ),
        date: this.$options.filters.preciseDateTime(
          client.createdAt,
          this.$i18n.locale
        ),
      });
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
    // The API answers its error code as the message (ERROR_CODES.MCP_…),
    // and names the redirect URI it refuses.
    errorText(error) {
      const { message: code, redirectUri } = error?.response?.data || {};
      if (redirectUri) {
        return this.$t('mcpClients.errors.redirectUriRefused', {
          uri: redirectUri,
        });
      }
      return code && this.$te(`mcpClients.errors.${code}`)
        ? this.$t(`mcpClients.errors.${code}`)
        : this.$t('global.errors.errorOccured');
    },
    notifyError(error) {
      this.showSnackbar({ text: this.errorText(error), color: 'error' });
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
          class="text-none"
          :disabled="loadError"
          @click="openCreateModal"
        >
          <lucide-plus :size="18" class="mr-2" />
          {{ $t('mcpClients.add') }}
        </v-btn>
      </template>
    </bs-page-header>
    <v-container fluid class="bs-mcp-clients">
      <p class="bs-mcp-clients__intro">
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

      <section
        v-else-if="clients.length"
        class="bs-mcp-clients__card"
        :aria-label="$t('mcpClients.listLabel')"
      >
        <ul class="bs-mcp-clients__list">
          <li
            v-for="client in clients"
            :key="client.clientId"
            class="bs-mcp-clients__client"
          >
            <span class="bs-mcp-clients__client-icon" aria-hidden="true">
              <lucide-key-round :size="18" />
            </span>
            <div class="bs-mcp-clients__client-text">
              <span class="bs-mcp-clients__client-name">{{ client.name }}</span>
              <span class="bs-mcp-clients__client-meta">
                {{ metaOf(client) }}
              </span>
              <span
                v-for="uri in client.redirectUris"
                :key="uri"
                class="bs-mcp-clients__client-uri"
              >
                {{ uri }}
              </span>
              <span class="bs-mcp-clients__client-uri">
                {{ $t('mcpClients.clientIdLine', { id: client.clientId }) }}
              </span>
            </div>
            <v-tooltip bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  color="error"
                  :aria-label="
                    $t('mcpClients.deleteNamed', { name: client.name })
                  "
                  v-bind="attrs"
                  @click="askDelete(client)"
                  v-on="on"
                >
                  <lucide-trash-2 :size="18" />
                </v-btn>
              </template>
              <span>{{
                $t('mcpClients.deleteNamed', { name: client.name })
              }}</span>
            </v-tooltip>
          </li>
        </ul>
        <p class="bs-mcp-clients__footnote">
          {{ $t('mcpClients.secretFootnote') }}
        </p>
      </section>

      <section v-else class="bs-mcp-clients__empty">
        <span class="bs-mcp-clients__empty-title">
          {{ $t('mcpClients.empty') }}
        </span>
        <span class="bs-mcp-clients__empty-text">
          {{ $t('mcpClients.emptyHint') }}
        </span>
      </section>

      <section
        class="bs-mcp-clients__card bs-mcp-clients__server"
        aria-labelledby="mcp-server-title"
      >
        <h2 id="mcp-server-title" class="bs-mcp-clients__server-title">
          {{ $t('mcpClients.serverTitle') }}
        </h2>
        <p class="bs-mcp-clients__server-text">
          {{ $t('mcpClients.serverDescription') }}
        </p>
        <bs-mcp-client-settings v-if="origin" :origin="origin" />
        <p class="bs-mcp-clients__footnote">
          {{ $t('mcpClients.settings.scopeHint') }}
        </p>
      </section>

      <bs-modal-create-mcp-client
        ref="createModal"
        :loading="modalLoading"
        @submit="createClient"
      />
      <bs-modal-mcp-client-secret :client="created" @close="closeCreated" />
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
.bs-mcp-clients {
  max-width: 880px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__intro {
    margin: 0;
    max-width: 680px;
    font-size: 0.875rem;
    color: var(--gray-800);
  }

  &__card {
    background: var(--surface);
    border: 1px solid var(--gray-300);
    border-radius: 10px;
    overflow: hidden;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__client {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1rem 1rem 1.5rem;

    & + & {
      border-top: 1px solid var(--gray-200);
    }
  }

  &__client-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--v-secondary-base);
    background: var(--v-secondary-lighten5);
  }

  &__client-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__client-name {
    font-weight: 600;
  }

  &__client-meta {
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__client-uri {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: var(--gray-700);
    overflow-wrap: anywhere;
  }

  &__footnote {
    margin: 0;
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__card > &__footnote {
    padding: 0.625rem 1.5rem;
    background: var(--surface-muted);
    border-top: 1px solid var(--gray-200);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 2rem;
    text-align: center;
    border: 1px dashed var(--field-border);
    border-radius: 10px;
    background: var(--surface);
  }

  &__empty-title {
    font-weight: 600;
  }

  &__empty-text {
    max-width: 440px;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__server .bs-mcp-client-settings {
    padding: 0 1rem 0.5rem 1.5rem;
  }

  &__server-title {
    margin: 0;
    padding: 1rem 1.5rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  &__server-text {
    margin: 0.125rem 0 0.5rem;
    padding: 0 1.5rem;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }
}
</style>
