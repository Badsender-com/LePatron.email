<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsMarkdownRenderer from '~/components/form/bs-markdown-renderer.vue';
import runOutputAsMarkdown from '~/helpers/run-output-markdown.js';

export default {
  name: 'BsAiPlaygroundRunCompareView',
  components: { BsModalConfirm, BsMarkdownRenderer },
  props: {
    goldenRun: { type: Object, default: null },
    currentRun: { type: Object, default: null },
  },
  computed: {
    goldenMarkdown() {
      return this.toMarkdown(this.goldenRun);
    },
    currentMarkdown() {
      return this.toMarkdown(this.currentRun);
    },
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    toMarkdown(run) {
      return runOutputAsMarkdown(run && run.output);
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiPlayground.runs.compare.title')"
    :is-form="true"
    modal-width="1100"
  >
    <div v-if="!goldenRun" class="text--disabled text-center my-4">
      {{ $t('aiPlayground.runs.compare.noGolden') }}
    </div>
    <v-row v-else dense>
      <v-col cols="12" md="6">
        <div class="compare-col">
          <p class="compare-col__header">
            {{ $t('aiPlayground.runs.compare.golden') }}
          </p>
          <bs-markdown-renderer :source="goldenMarkdown" />
        </div>
      </v-col>
      <v-col cols="12" md="6">
        <div class="compare-col">
          <p class="compare-col__header">
            {{ $t('aiPlayground.runs.compare.current') }}
          </p>
          <bs-markdown-renderer :source="currentMarkdown" />
        </div>
      </v-col>
    </v-row>

    <v-divider class="mt-4" />
    <div class="modal-actions">
      <v-btn text color="primary" @click="close">
        {{ $t('global.close') }}
      </v-btn>
    </div>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.compare-col {
  background: #fafafa;
  padding: 0.75rem;
  border-radius: 4px;
  max-height: 480px;
  overflow: auto;

  &__header {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.5rem;
  }
}
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
