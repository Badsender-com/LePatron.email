<script>
import { mapMutations } from 'vuex';
import { Copy, Check } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import copyToClipboard from '~/helpers/copy-to-clipboard.js';

/**
 * What an assistant's set-up screen asks for, each with a copy button: the
 * authorization server's URLs and scope, or, after a creation, the client's
 * id and its secret.
 */
export default {
  name: 'BsMcpClientSettings',
  components: { LucideCopy: Copy, LucideCheck: Check },
  props: {
    origin: { type: String, default: '' },
    // Given, the rows are the client's id and secret instead of the server's.
    client: { type: Object, default: null },
  },
  data() {
    return { copiedKey: null };
  },
  computed: {
    rows() {
      if (this.client) {
        return [
          { key: 'clientId', value: this.client.clientId },
          { key: 'clientSecret', value: this.client.clientSecret },
        ];
      }
      return [
        { key: 'mcpUrl', value: `${this.origin}/mcp` },
        { key: 'authorizationUrl', value: `${this.origin}/oauth/auth` },
        { key: 'tokenUrl', value: `${this.origin}/oauth/token` },
        { key: 'scope', value: 'mcp:read' },
      ];
    },
  },
  beforeDestroy() {
    clearTimeout(this.copiedTimer);
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    copyLabel(key) {
      return this.$t('mcpClients.copyField', {
        field: this.$t(`mcpClients.settings.${key}`),
      });
    },
    // On a browser that cannot copy, the value stays on screen to select.
    async copy(row) {
      if (!(await copyToClipboard(row.value))) {
        this.showSnackbar({
          text: this.$t('mcpClients.copyFailed'),
          color: 'error',
        });
        return;
      }
      this.copiedKey = row.key;
      this.$emit('copied', row.key);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copiedKey = null;
      }, 2000);
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
      <dt class="bs-mcp-client-settings__label">
        {{ $t(`mcpClients.settings.${row.key}`) }}
      </dt>
      <dd class="bs-mcp-client-settings__value">
        <code>{{ row.value }}</code>
        <v-btn
          text
          small
          class="text-none"
          :color="copiedKey === row.key ? 'success' : undefined"
          :aria-label="copyLabel(row.key)"
          @click="copy(row)"
        >
          <lucide-check v-if="copiedKey === row.key" :size="14" class="mr-1" />
          <lucide-copy v-else :size="14" class="mr-1" />
          {{
            copiedKey === row.key
              ? $t('mcpClients.copied')
              : $t('mcpClients.copy')
          }}
        </v-btn>
      </dd>
    </div>
  </dl>
</template>

<style lang="scss" scoped>
.bs-mcp-client-settings {
  margin: 0;

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;

    & + & {
      border-top: 1px solid rgba(0, 0, 0, 0.08);
    }
  }

  // The one value that is never shown again.
  &__row--secret {
    padding: 0.5rem 0.75rem;
    border-radius: 5px;
    border: 1px solid rgba(255, 180, 0, 0.6);
    background: rgba(255, 180, 0, 0.08);
  }

  &__label {
    font-size: 0.8125rem;
    color: rgba(0, 0, 0, 0.6);
  }

  &__value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;

    code {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      background: transparent;
      padding: 0;
      font-size: 0.8125rem;
      color: rgba(0, 0, 0, 0.87);
    }
  }
}

@media (max-width: 600px) {
  .bs-mcp-client-settings__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25rem;
  }
}
</style>
