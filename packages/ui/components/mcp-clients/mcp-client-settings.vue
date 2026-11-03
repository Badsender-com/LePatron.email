<script>
import { mapMutations } from 'vuex';
import { Copy } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

/**
 * What an assistant's set-up screen asks for, each with a copy button: the
 * authorization server's URLs and scope, and, after a creation, the client's
 * id and its secret.
 */
export default {
  name: 'BsMcpClientSettings',
  components: { LucideCopy: Copy },
  props: {
    origin: { type: String, required: true },
    client: { type: Object, default: null },
  },
  computed: {
    rows() {
      const server = [
        { key: 'mcpUrl', value: `${this.origin}/mcp` },
        { key: 'authorizationUrl', value: `${this.origin}/oauth/auth` },
        { key: 'tokenUrl', value: `${this.origin}/oauth/token` },
        { key: 'refreshUrl', value: `${this.origin}/oauth/token` },
        { key: 'scope', value: 'mcp:read' },
      ];
      if (!this.client) return server;
      return [
        { key: 'clientId', value: this.client.clientId },
        { key: 'clientSecret', value: this.client.clientSecret },
        ...server,
      ];
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    copyLabel(key) {
      return this.$t('mcpClients.copyField', {
        field: this.$t(`mcpClients.settings.${key}`),
      });
    },
    async copy(value) {
      try {
        await navigator.clipboard.writeText(value);
        this.showSnackbar({
          text: this.$t('mcpClients.copied'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
  },
};
</script>

<template>
  <dl class="bs-mcp-client-settings">
    <div
      v-for="row in rows"
      :key="row.key"
      :class="[
        'bs-mcp-client-settings__row',
        { 'bs-mcp-client-settings__row--secret': row.key === 'clientSecret' },
      ]"
    >
      <dt class="text-caption text--secondary">
        {{ $t(`mcpClients.settings.${row.key}`) }}
      </dt>
      <dd class="bs-mcp-client-settings__value">
        <code>{{ row.value }}</code>
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              small
              :aria-label="copyLabel(row.key)"
              v-bind="attrs"
              @click="copy(row.value)"
              v-on="on"
            >
              <lucide-copy :size="16" />
            </v-btn>
          </template>
          <span>{{ copyLabel(row.key) }}</span>
        </v-tooltip>
      </dd>
      <dd
        v-if="row.key === 'scope'"
        class="text-caption text--secondary mt-1 mb-0"
      >
        {{ $t('mcpClients.settings.scopeHint') }}
      </dd>
    </div>
  </dl>
</template>

<style lang="scss" scoped>
.bs-mcp-client-settings {
  margin: 0;

  &__row + &__row {
    margin-top: 8px;
  }

  // The one value that is never shown again.
  &__row--secret {
    padding: 8px;
    border-left: 3px solid var(--v-warning-base);
    background: rgba(0, 0, 0, 0.03);
  }

  &__value {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;

    code {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      background: transparent;
      padding: 0;
    }
  }
}
</style>
