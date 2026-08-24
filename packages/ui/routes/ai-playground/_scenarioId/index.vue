<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-playground-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsAiPlaygroundScenarioForm from '~/components/ai-playground/bs-ai-playground-scenario-form.vue';
import BsAiPlaygroundRunSection from '~/components/ai-playground/bs-ai-playground-run-section.vue';
import { inferExpertiseMode } from '~/helpers/expertise-filter.js';
import { Trash2 } from 'lucide-vue';

export default {
  name: 'PageAiPlaygroundDetail',
  components: {
    BsPageHeader,
    BsModalConfirm,
    BsAiPlaygroundScenarioForm,
    BsAiPlaygroundRunSection,
    LucideTrash2: Trash2,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN, sidebarModule: 'settings' },
  async asyncData({ $axios, params, error }) {
    try {
      const [scenario, runsRes] = await Promise.all([
        $axios.$get(api.aiPlaygroundScenario(params.scenarioId)),
        $axios.$get(api.aiPlaygroundScenarioRuns(params.scenarioId), {
          params: { pageSize: 50 },
        }),
      ]);
      return { scenario, initialRuns: runsRes.items || [] };
    } catch (err) {
      return error({ statusCode: 404, message: 'Scenario not found' });
    }
  },
  data() {
    return {
      scenario: null,
      initialRuns: [],
      expertiseMode: 'none',
      inputValid: true,
      saving: false,
      // Structured validation errors from the latest execute — the form and
      // the run section are siblings, this page is their junction.
      fieldErrors: [],
    };
  },
  head() {
    return { title: this.scenario ? this.scenario.name : 'Scenario' };
  },
  computed: {
    canExecute() {
      return !!(
        this.scenario &&
        this.scenario.skillRef &&
        this.scenario.skillRef.skillId &&
        this.inputValid
      );
    },
  },
  mounted() {
    if (this.scenario) {
      this.expertiseMode = inferExpertiseMode(this.scenario);
    }
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    // Returns true on success so callers (execute flow) can abort on failure.
    async saveScenario() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      await this.$nextTick();
      this.saving = true;
      try {
        const patch = {
          name: this.scenario.name,
          description: this.scenario.description,
          tags: this.scenario.tags,
          skillRef: this.scenario.skillRef,
          expertiseRefs: this.scenario.expertiseRefs,
          expertiseFilter: this.scenario.expertiseFilter,
          input: this.scenario.input,
          providerOverride: this.scenario.providerOverride,
          groupContext: this.scenario.groupContext,
        };
        this.scenario = await this.$axios.$patch(
          api.aiPlaygroundScenario(this.scenario.scenarioId),
          patch
        );
        this.showSnackbar({
          text: this.$t('aiPlayground.updated'),
          color: 'success',
        });
        return true;
      } catch (err) {
        this.handleError(err);
        return false;
      } finally {
        this.saving = false;
      }
    },
    async deleteScenario() {
      this.saving = true;
      try {
        await this.$axios.$delete(
          api.aiPlaygroundScenario(this.scenario.scenarioId)
        );
        this.showSnackbar({
          text: this.$t('aiPlayground.deleted'),
          color: 'success',
        });
        this.$router.push('/ai-playground');
      } catch (err) {
        this.handleError(err);
      } finally {
        this.saving = false;
      }
    },
    onGoldenChanged(runId) {
      this.scenario.goldenRunId = runId;
    },
    handleError(err) {
      const msg =
        (err.response && err.response.data && err.response.data.message) ||
        this.$t('global.errors.errorOccured');
      this.showSnackbar({ text: msg, color: 'error' });
    },
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :back="{ to: '/ai-playground' }"
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ scenario.name }}
      </template>
      <template #actions>
        <v-btn
          outlined
          color="error"
          :disabled="saving"
          @click="$refs.deleteModal.open()"
        >
          <lucide-trash2 :size="18" class="mr-2" />
          {{ $t('aiPlayground.actions.delete') }}
        </v-btn>
      </template>
    </bs-page-header>

    <v-container fluid>
      <bs-ai-playground-scenario-form
        v-model="scenario"
        :expertise-mode="expertiseMode"
        :saving="saving"
        :field-errors="fieldErrors"
        @update:expertise-mode="expertiseMode = $event"
        @input-valid="inputValid = $event"
      />

      <v-divider class="my-4" />

      <bs-ai-playground-run-section
        :scenario-id="scenario.scenarioId"
        :golden-run-id="scenario.goldenRunId"
        :can-execute="canExecute"
        :initial-runs="initialRuns"
        :before-execute="saveScenario"
        @golden-changed="onGoldenChanged"
        @validation-errors="fieldErrors = $event"
      >
        <template #actions-start>
          <v-btn
            outlined
            color="primary"
            large
            :loading="saving"
            @click="saveScenario"
          >
            {{ $t('global.save') }}
          </v-btn>
        </template>
      </bs-ai-playground-run-section>
    </v-container>

    <bs-modal-confirm
      ref="deleteModal"
      :title="$t('aiPlayground.deleteScenarioConfirm')"
      :is-form="true"
      modal-width="450"
    >
      <p>{{ $t('aiPlayground.deleteScenarioConfirm') }}</p>
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" @click="$refs.deleteModal.close()">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          color="error"
          elevation="0"
          :loading="saving"
          @click="deleteScenario"
        >
          {{ $t('aiPlayground.actions.delete') }}
        </v-btn>
      </div>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
