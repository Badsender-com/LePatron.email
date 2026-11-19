<script>
import { Check, AlertTriangle } from 'lucide-vue';

/**
 * A secret shown once, kept nowhere in the page after: an MCP client's
 * secret, a read token. Only its button closes the dialog, once the secret
 * is copied (`copied`), or once the person ticks that it is saved, for a
 * browser that cannot copy: never a dialog they cannot leave. The box starts
 * unticked each time the dialog opens.
 *
 * The secret and its copy button go in the default slot; what follows the
 * warning, in `after-warning`.
 */
export default {
  name: 'BsSecretOnceDialog',
  components: { LucideCheck: Check, LucideAlertTriangle: AlertTriangle },
  props: {
    open: { type: Boolean, default: false },
    badge: { type: String, required: true },
    title: { type: String, required: true },
    // That the secret will not be shown again.
    warning: { type: String, required: true },
    savedLabel: { type: String, required: true },
    // What to do before closing, shown while the dialog cannot close.
    copyFirstLabel: { type: String, required: true },
    doneLabel: { type: String, required: true },
    copied: { type: Boolean, default: false },
  },
  data() {
    return { saved: false };
  },
  computed: {
    canClose() {
      return this.copied || this.saved;
    },
  },
  watch: {
    open(isOpen) {
      if (isOpen) this.saved = false;
    },
  },
  methods: {
    close() {
      if (this.canClose) this.$emit('close');
    },
  },
};
</script>

<template>
  <!-- Closed only by its button: the secret is shown this once. -->
  <v-dialog :value="open" width="560" persistent>
    <v-card v-if="open" flat tile>
      <v-card-title class="bs-secret-once-dialog__title">
        <v-chip small color="success" dark label>
          <lucide-check :size="14" class="mr-1" />
          {{ badge }}
        </v-chip>
        <span>{{ title }}</span>
      </v-card-title>
      <v-card-text>
        <slot />
        <p class="bs-secret-once-dialog__warning">
          <lucide-alert-triangle :size="14" />
          {{ warning }}
        </p>
        <slot name="after-warning" />
        <v-checkbox
          :input-value="saved"
          :label="savedLabel"
          color="accent"
          hide-details
          class="bs-secret-once-dialog__saved"
          @change="saved = $event === true"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <span v-if="!canClose" class="bs-secret-once-dialog__footnote mr-3">
          {{ copyFirstLabel }}
        </span>
        <v-btn
          color="accent"
          elevation="0"
          class="text-none bs-secret-once-dialog__done"
          :disabled="!canClose"
          @click="close"
        >
          {{ doneLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
.bs-secret-once-dialog {
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
