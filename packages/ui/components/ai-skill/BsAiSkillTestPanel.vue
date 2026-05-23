<script>
import * as api from '~/helpers/ai-skill-routes.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import { Play } from 'lucide-vue';

export default {
  name: 'BsAiSkillTestPanel',
  components: {
    BsTextField,
    BsTextarea,
    LucidePlay: Play,
  },
  props: {
    skillId: { type: String, required: true },
  },
  data() {
    return {
      groupId: '',
      input: '{\n  "prompt": "Hello"\n}',
      result: null,
      error: null,
      running: false,
    };
  },
  methods: {
    async run() {
      this.running = true;
      this.error = null;
      this.result = null;
      try {
        const input = JSON.parse(this.input);
        this.result = await this.$axios.$post(api.aiSkillTest(this.skillId), {
          input,
          groupId: this.groupId,
        });
      } catch (err) {
        this.error =
          (err.response && err.response.data && err.response.data.message) ||
          err.message;
      } finally {
        this.running = false;
      }
    },
  },
};
</script>

<template>
  <v-card outlined class="pa-4">
    <p class="text-caption text--secondary mb-3">
      {{ $t('aiSkills.test.caption') }}
    </p>
    <bs-text-field
      v-model="groupId"
      :label="$t('aiSkills.test.groupIdLabel')"
      required
    />
    <bs-textarea
      v-model="input"
      :label="$t('aiSkills.test.inputLabel')"
      :rows="6"
      monospace
    />
    <div class="d-flex justify-end mt-2">
      <v-btn
        color="accent"
        elevation="0"
        :loading="running"
        :disabled="!groupId"
        @click="run"
      >
        <lucide-play :size="18" class="mr-2" />
        {{ $t('aiSkills.test.run') }}
      </v-btn>
    </div>
    <v-alert v-if="error" type="error" dense outlined class="mt-3">
      {{ error }}
    </v-alert>
    <v-card v-if="result" outlined class="mt-3 pa-3">
      <p class="text-caption text--secondary mb-2">
        {{ $t('aiSkills.test.latency') }} {{ result.latencyMs }}ms ·
        {{ (result.tokenUsage && result.tokenUsage.promptTokens) || 0 }}/{{
          (result.tokenUsage && result.tokenUsage.completionTokens) || 0
        }}
        {{ $t('aiSkills.test.tokens') }} ·
        {{ $t('aiSkills.test.model') }}
        {{ result.resolvedConfig && result.resolvedConfig.model }}
      </p>
      <pre class="code-block">{{ JSON.stringify(result.output, null, 2) }}</pre>
    </v-card>
  </v-card>
</template>

<style lang="scss" scoped>
.code-block {
  background: #f5f5f5;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  max-height: 320px;
  overflow: auto;
  margin: 0;
}
</style>
