<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-playground-routes.js';
import BsAiPlaygroundRunResult from './BsAiPlaygroundRunResult.vue';
import BsAiPlaygroundRunsList from './BsAiPlaygroundRunsList.vue';
import BsAiPlaygroundRunDetailModal from './BsAiPlaygroundRunDetailModal.vue';
import BsAiPlaygroundRunCompareView from './BsAiPlaygroundRunCompareView.vue';
import { Play } from 'lucide-vue';

export default {
  name: 'BsAiPlaygroundRunSection',
  components: {
    BsAiPlaygroundRunResult,
    BsAiPlaygroundRunsList,
    BsAiPlaygroundRunDetailModal,
    BsAiPlaygroundRunCompareView,
    LucidePlay: Play,
  },
  props: {
    scenarioId: { type: String, required: true },
    goldenRunId: { type: String, default: null },
    canExecute: { type: Boolean, default: false },
    initialRuns: { type: Array, default: () => [] },
  },
  data() {
    return {
      runs: [...this.initialRuns],
      latestRun: null,
      detailRun: null,
      goldenRun: null,
      executing: false,
      runDetailLoading: false,
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async execute() {
      this.executing = true;
      try {
        const run = await this.$axios.$post(
          api.aiPlaygroundExecute(this.scenarioId)
        );
        this.latestRun = run;
        // Structured validation errors (transient, execute response only) go
        // up to the page, which relays them to the scenario form for inline
        // display. Emit [] on any other outcome to clear previous errors.
        this.$emit(
          'validation-errors',
          run.status === 'VALIDATION_ERROR' ? run.fieldErrors || [] : []
        );
        await this.reloadRuns();
      } catch (err) {
        this.handleError(err);
      } finally {
        this.executing = false;
      }
    },
    async reloadRuns() {
      const res = await this.$axios.$get(
        api.aiPlaygroundScenarioRuns(this.scenarioId),
        { params: { pageSize: 50 } }
      );
      this.runs = res.items || [];
    },
    async openRun(item) {
      this.runDetailLoading = true;
      try {
        this.detailRun = await this.$axios.$get(api.aiPlaygroundRun(item._id));
        this.$refs.runDetailModal.open();
      } catch (err) {
        this.handleError(err);
      } finally {
        this.runDetailLoading = false;
      }
    },
    async saveFeedback(payload) {
      if (!this.detailRun) return;
      this.runDetailLoading = true;
      try {
        this.detailRun = await this.$axios.$patch(
          api.aiPlaygroundRunFeedback(this.detailRun._id),
          payload
        );
        this.showSnackbar({
          text: this.$t('aiPlayground.runs.feedback.saved'),
          color: 'success',
        });
        await this.reloadRuns();
      } catch (err) {
        this.handleError(err);
      } finally {
        this.runDetailLoading = false;
      }
    },
    async markGolden() {
      if (!this.detailRun) return;
      this.runDetailLoading = true;
      try {
        this.detailRun = await this.$axios.$post(
          api.aiPlaygroundRunMarkGolden(this.detailRun._id)
        );
        this.$emit('golden-changed', this.detailRun._id);
        this.showSnackbar({
          text: this.$t('aiPlayground.goldenMarked'),
          color: 'success',
        });
        await this.reloadRuns();
      } catch (err) {
        this.handleError(err);
      } finally {
        this.runDetailLoading = false;
      }
    },
    async unmarkGolden() {
      if (!this.detailRun) return;
      this.runDetailLoading = true;
      try {
        this.detailRun = await this.$axios.$post(
          api.aiPlaygroundRunUnmarkGolden(this.detailRun._id)
        );
        this.$emit('golden-changed', null);
        this.showSnackbar({
          text: this.$t('aiPlayground.goldenUnmarked'),
          color: 'info',
        });
        await this.reloadRuns();
      } catch (err) {
        this.handleError(err);
      } finally {
        this.runDetailLoading = false;
      }
    },
    async openCompare() {
      if (!this.goldenRunId) {
        this.goldenRun = null;
      } else {
        try {
          this.goldenRun = await this.$axios.$get(
            api.aiPlaygroundRun(this.goldenRunId)
          );
        } catch (err) {
          this.goldenRun = null;
        }
      }
      this.$refs.compareView.open();
    },
    handleError(err) {
      // Consultant-friendly message for the daily test budget (HTTP 429) —
      // the raw server message is English and technical.
      const status = err.response && err.response.status;
      const msg =
        status === 429
          ? this.$t('aiPlayground.runs.budgetExhausted')
          : (err.response && err.response.data && err.response.data.message) ||
            this.$t('global.errors.errorOccured');
      this.showSnackbar({ text: msg, color: 'error' });
    },
  },
};
</script>

<template>
  <div>
    <div class="d-flex align-center mb-3" style="gap: 0.75rem">
      <v-btn
        color="accent"
        elevation="0"
        large
        :loading="executing"
        :disabled="!canExecute"
        @click="execute"
      >
        <lucide-play :size="18" class="mr-2" />
        {{ $t('aiPlayground.actions.execute') }}
      </v-btn>
      <span v-if="executing" class="text-caption text--secondary">
        {{ $t('aiPlayground.runs.executing') }}
      </span>
    </div>

    <bs-ai-playground-run-result v-if="latestRun" :run="latestRun" />

    <h3 class="section-title mt-6">
      {{ $t('aiPlayground.runs.title') }}
    </h3>
    <bs-ai-playground-runs-list :runs="runs" @open="openRun" />

    <bs-ai-playground-run-detail-modal
      ref="runDetailModal"
      :run="detailRun"
      :loading="runDetailLoading"
      @save-feedback="saveFeedback"
      @mark-golden="markGolden"
      @unmark-golden="unmarkGolden"
      @compare="openCompare"
    />
    <bs-ai-playground-run-compare-view
      ref="compareView"
      :golden-run="goldenRun"
      :current-run="detailRun"
    />
  </div>
</template>

<style lang="scss" scoped>
.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 0.75rem;
}
</style>
