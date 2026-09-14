<script>
import BsMarkdownRenderer from '~/components/form/bs-markdown-renderer.vue';
import { latencySeconds } from '~/helpers/format-latency.js';
import runOutputAsMarkdown from '~/helpers/run-output-markdown.js';

export default {
  name: 'BsAiPlaygroundRunResult',
  components: { BsMarkdownRenderer },
  props: {
    run: { type: Object, default: null },
  },
  computed: {
    statusColor() {
      if (!this.run) return 'grey';
      return this.run.status === 'SUCCESS' ? 'success' : 'error';
    },
    statusLabel() {
      if (!this.run) return '';
      return this.$t(`aiPlayground.status.${this.run.status}`);
    },
    outputAsMarkdown() {
      return runOutputAsMarkdown(this.run && this.run.output);
    },
    totalTokens() {
      const u = (this.run && this.run.tokenUsage) || {};
      return (u.promptTokens || 0) + (u.completionTokens || 0);
    },
  },
  methods: { latencySeconds },
};
</script>

<template>
  <v-card v-if="run" outlined class="pa-3">
    <div class="d-flex align-center mb-2" style="gap: 0.5rem">
      <v-chip
        small
        :color="statusColor"
        :dark="statusColor === 'success'"
        :outlined="statusColor !== 'success'"
      >
        {{ statusLabel }}
      </v-chip>
      <span class="text-caption text--secondary" :title="`${run.latencyMs} ms`">
        {{ latencySeconds(run.latencyMs) }} · {{ totalTokens }} tokens
      </span>
      <v-spacer />
      <span v-if="run.resolvedSkill" class="text-caption text--secondary">
        {{ run.resolvedSkill.skillId }} v{{ run.resolvedSkill.versionMajor }}.{{
          run.resolvedSkill.versionMinor
        }}
      </span>
    </div>

    <v-alert v-if="run.errorMessage" type="error" dense outlined class="mb-2">
      {{ run.errorMessage }}
    </v-alert>

    <bs-markdown-renderer v-if="run.output" :source="outputAsMarkdown" />
  </v-card>
</template>
