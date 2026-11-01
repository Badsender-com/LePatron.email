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
    <div v-for="row in rows" :key="row.key" class="bs-mcp-client-settings__row">
      <dt class="text-caption text--secondary">
        {{ $t(`mcpClients.settings.${row.key}`) }}
      </dt>
      <dd class="bs-mcp-client-settings__value">
        <code>{{ row.value }}</code>
        <v-btn
          icon
          small
          :aria-label="$t('mcpClients.copy')"
          @click="copy(row.value)"
        >
          <lucide-copy :size="16" />
        </v-btn>
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
