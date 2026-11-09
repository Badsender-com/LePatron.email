<script>
import { Check, AlertTriangle } from 'lucide-vue';
import BsMcpClientSettings from '~/components/mcp-clients/mcp-client-settings.vue';

/**
 * The client just created, with its secret: shown this once, kept nowhere in
 * the page. The dialog closes once the secret is copied, or once the admin
 * says it is saved, for a browser that cannot copy.
 */
export default {
  name: 'BsModalMcpClientSecret',
  components: {
    BsMcpClientSettings,
    LucideCheck: Check,
    LucideAlertTriangle: AlertTriangle,
  },
  props: {
    // The client, `clientSecret` included; null, the dialog is closed.
    client: { type: Object, default: null },
  },
  data() {
    return { secretCopied: false, secretSaved: false };
  },
  computed: {
    canClose() {
      return this.secretCopied || this.secretSaved;
    },
  },
  watch: {
    client() {
      this.secretCopied = false;
      this.secretSaved = false;
    },
  },
  methods: {
    onCopied(key) {
      if (key === 'clientSecret') this.secretCopied = true;
    },
    close() {
      if (this.canClose) this.$emit('close');
    },
  },
};
</script>

<template>
  <!-- Closed only by its button: the secret is shown this once. -->
  <v-dialog :value="!!client" width="560" persistent>
    <v-card v-if="client" flat tile>
      <v-card-title class="bs-modal-mcp-client-secret__title">
        <v-chip small color="success" dark label>
          <lucide-check :size="14" class="mr-1" />
          {{ $t('mcpClients.createdBadge') }}
        </v-chip>
        <span>{{ $t('mcpClients.createdTitle', { name: client.name }) }}</span>
      </v-card-title>
      <v-card-text>
        <bs-mcp-client-settings :client="client" @copied="onCopied" />
        <p class="bs-modal-mcp-client-secret__warning">
          <lucide-alert-triangle :size="14" />
          {{ $t('mcpClients.secretOnce') }}
        </p>
        <p class="bs-modal-mcp-client-secret__footnote">
          {{ $t('mcpClients.serverOnPage') }}
        </p>
        <v-checkbox
          :input-value="secretSaved"
          :label="$t('mcpClients.secretSavedConfirm')"
          color="accent"
          hide-details
          class="bs-modal-mcp-client-secret__saved"
          @change="secretSaved = $event === true"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <span
          v-if="!canClose"
          class="bs-modal-mcp-client-secret__footnote mr-3"
        >
          {{ $t('mcpClients.copySecretFirst') }}
        </span>
        <v-btn
          color="accent"
          elevation="0"
          class="text-none"
          :disabled="!canClose"
          @click="close"
        >
          {{ $t('mcpClients.secretDone') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
.bs-modal-mcp-client-secret {
  &__title {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    word-break: normal;
  }

  &__warning {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0.75rem 0 0.5rem;
    font-size: 0.75rem;
    color: var(--v-warning-darken3);
  }

  &__footnote {
    margin: 0;
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__saved {
    margin-top: 0.75rem;
    padding-top: 0;
  }
}
</style>
