<script>
import BsMcpClientSettings from '~/components/mcp-clients/mcp-client-settings.vue';
import BsSecretOnceDialog from '~/components/modal/bs-secret-once-dialog.vue';

/**
 * The client just created, with its secret: shown this once, kept nowhere in
 * the page. The dialog closes once the secret is copied, or once the admin
 * says it is saved, for a browser that cannot copy.
 */
export default {
  name: 'BsModalMcpClientSecret',
  components: { BsMcpClientSettings, BsSecretOnceDialog },
  props: {
    // The client, `clientSecret` included; null, the dialog is closed.
    client: { type: Object, default: null },
  },
  data() {
    return { secretCopied: false };
  },
  watch: {
    client() {
      this.secretCopied = false;
    },
  },
  methods: {
    onCopied(key) {
      if (key === 'clientSecret') this.secretCopied = true;
    },
  },
};
</script>

<template>
  <bs-secret-once-dialog
    :open="!!client"
    :badge="$t('mcpClients.createdBadge')"
    :title="client ? $t('mcpClients.createdTitle', { name: client.name }) : ''"
    :warning="$t('mcpClients.secretOnce')"
    :saved-label="$t('mcpClients.secretSavedConfirm')"
    :copy-first-label="$t('mcpClients.copySecretFirst')"
    :done-label="$t('mcpClients.secretDone')"
    :copied="secretCopied"
    @close="$emit('close')"
  >
    <bs-mcp-client-settings v-if="client" :client="client" @copied="onCopied" />
    <template #after-warning>
      <p class="bs-modal-mcp-client-secret__footnote">
        {{ $t('mcpClients.serverOnPage') }}
      </p>
    </template>
  </bs-secret-once-dialog>
</template>

<style lang="scss" scoped>
.bs-modal-mcp-client-secret__footnote {
  margin: 0;
  font-size: 0.75rem;
  color: var(--gray-700);
}
</style>
