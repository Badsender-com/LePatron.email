<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsMarkdownRenderer from '~/components/form/bs-markdown-renderer.vue';
import { Star, GitCompare } from 'lucide-vue';

export default {
  name: 'BsAiPlaygroundRunDetailModal',
  components: {
    BsModalConfirm,
    BsSelect,
    BsTextarea,
    BsMarkdownRenderer,
    LucideStar: Star,
    LucideGitCompare: GitCompare,
  },
  props: {
    run: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      tab: 'output',
      feedbackDraft: {
        rating: null,
        score: null,
        comment: '',
      },
    };
  },
  computed: {
    ratingOptions() {
      return ['positive', 'neutral', 'negative'].map((r) => ({
        value: r,
        text: this.$t(
          'aiPlayground.runs.feedback.rating' +
            r.charAt(0).toUpperCase() +
            r.slice(1)
        ),
      }));
    },
    outputAsMarkdown() {
      if (!this.run || this.run.output == null) return '';
      const o = this.run.output;
      if (typeof o === 'string') return o;
      if (o.text && typeof o.text === 'string') return o.text;
      if (o.markdown && typeof o.markdown === 'string') return o.markdown;
      return '```json\n' + JSON.stringify(o, null, 2) + '\n```';
    },
    inputJson() {
      if (!this.run) return '';
      return JSON.stringify(this.run.composedInput || {}, null, 2);
    },
    rawOutput() {
      if (!this.run) return '';
      const o = this.run.output;
      if (o == null) return '';
      return typeof o === 'string' ? o : JSON.stringify(o, null, 2);
    },
  },
  watch: {
    run(next) {
      if (next && next.feedback) {
        this.feedbackDraft = {
          rating: next.feedback.rating || null,
          score: next.feedback.score || null,
          comment: next.feedback.comment || '',
        };
      } else {
        this.feedbackDraft = { rating: null, score: null, comment: '' };
      }
    },
  },
  methods: {
    open() {
      this.tab = 'output';
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    saveFeedback() {
      this.$emit('save-feedback', { ...this.feedbackDraft });
    },
    toggleGolden() {
      if (this.run && this.run.isGolden) {
        this.$emit('unmark-golden');
      } else {
        this.$emit('mark-golden');
      }
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="run ? `Run ${run._id}` : ''"
    :is-form="true"
    modal-width="900"
  >
    <div v-if="run">
      <div class="d-flex align-center mb-3" style="gap: 0.5rem">
        <v-chip
          small
          :color="run.status === 'SUCCESS' ? 'success' : 'error'"
          :dark="run.status === 'SUCCESS'"
          :outlined="run.status !== 'SUCCESS'"
        >
          {{ $t(`aiPlayground.status.${run.status}`) }}
        </v-chip>
        <span class="text-caption text--secondary">
          {{ run.latencyMs }} ms ·
          {{ (run.tokenUsage && run.tokenUsage.promptTokens) || 0 }}/{{
            (run.tokenUsage && run.tokenUsage.completionTokens) || 0
          }}
          tokens
        </span>
        <v-spacer />
        <v-btn
          text
          small
          :color="run.isGolden ? 'accent' : 'primary'"
          :loading="loading"
          @click="toggleGolden"
        >
          <lucide-star :size="16" class="mr-1" />
          {{
            run.isGolden
              ? $t('aiPlayground.actions.unmarkGolden')
              : $t('aiPlayground.actions.markGolden')
          }}
        </v-btn>
        <v-btn text small color="primary" @click="$emit('compare')">
          <lucide-git-compare :size="16" class="mr-1" />
          {{ $t('aiPlayground.actions.compare') }}
        </v-btn>
      </div>

      <v-tabs v-model="tab" class="mb-2">
        <v-tab href="#output">
          {{ $t('aiPlayground.runs.tabs.output') }}
        </v-tab>
        <v-tab href="#input">
          {{ $t('aiPlayground.runs.tabs.input') }}
        </v-tab>
        <v-tab href="#raw">
          {{ $t('aiPlayground.runs.tabs.raw') }}
        </v-tab>
        <v-tab href="#feedback">
          {{ $t('aiPlayground.runs.tabs.feedback') }}
        </v-tab>
      </v-tabs>

      <v-tabs-items v-model="tab">
        <v-tab-item value="output">
          <bs-markdown-renderer :source="outputAsMarkdown" />
        </v-tab-item>
        <v-tab-item value="input">
          <pre class="code-block">{{ inputJson }}</pre>
        </v-tab-item>
        <v-tab-item value="raw">
          <pre class="code-block">{{ rawOutput }}</pre>
        </v-tab-item>
        <v-tab-item value="feedback">
          <bs-select
            v-model="feedbackDraft.rating"
            :items="ratingOptions"
            item-text="text"
            item-value="value"
            :label="$t('aiPlayground.runs.feedback.rating')"
            clearable
          />
          <bs-select
            v-model="feedbackDraft.score"
            :items="[1, 2, 3, 4, 5].map((n) => ({ value: n, text: String(n) }))"
            item-text="text"
            item-value="value"
            :label="$t('aiPlayground.runs.feedback.score')"
            clearable
          />
          <bs-textarea
            v-model="feedbackDraft.comment"
            :label="$t('aiPlayground.runs.feedback.comment')"
            :rows="3"
          />
          <div class="d-flex justify-end">
            <v-btn
              color="accent"
              elevation="0"
              :loading="loading"
              @click="saveFeedback"
            >
              {{ $t('aiPlayground.runs.feedback.save') }}
            </v-btn>
          </div>
        </v-tab-item>
      </v-tabs-items>
    </div>

    <v-divider class="mt-4" />
    <div class="modal-actions">
      <v-btn text color="primary" @click="close">
        {{ $t('global.close') }}
      </v-btn>
    </div>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.code-block {
  background: #f5f5f5;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  max-height: 360px;
  overflow: auto;
  margin: 0;
}
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
