<script>
import BsMarkdownRenderer from '~/components/form/bs-markdown-renderer.vue';

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
      if (!this.run || this.run.output == null) return '';
      // The skill output is typically an object; if it contains a string
      // field obviously meant as the rendered text (text/markdown/html), use
      // that. Otherwise fall back to JSON-stringified pretty output.
      const o = this.run.output;
      if (typeof o === 'string') return o;
      if (o.text && typeof o.text === 'string') return o.text;
      if (o.markdown && typeof o.markdown === 'string') return o.markdown;
      return '```json\n' + JSON.stringify(o, null, 2) + '\n```';
    },
    totalTokens() {
      const u = (this.run && this.run.tokenUsage) || {};
      return (u.promptTokens || 0) + (u.completionTokens || 0);
    },
  },
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
      <span class="text-caption text--secondary">
        {{ run.latencyMs }} ms · {{ totalTokens }} tokens
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
