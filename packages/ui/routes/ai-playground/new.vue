<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as api from '~/helpers/ai-playground-routes.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';
import BsAiPlaygroundScenarioForm from '~/components/ai-playground/BsAiPlaygroundScenarioForm.vue';

export default {
  name: 'PageAiPlaygroundNew',
  components: { BsPageHeader, BsAiPlaygroundScenarioForm },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_ADMIN, sidebarModule: 'settings' },
  data() {
    return {
      scenario: this.emptyScenario(),
      expertiseMode: 'none',
      inputValid: true,
      saving: false,
    };
  },
  head() {
    return { title: this.$t('aiPlayground.actions.newScenario') };
  },
  computed: {
    canSubmit() {
      return (
        !!this.scenario.scenarioId &&
        !!this.scenario.name &&
        !!(this.scenario.skillRef && this.scenario.skillRef.skillId) &&
        this.inputValid
      );
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    emptyScenario() {
      return {
        scenarioId: '',
        name: '',
        description: '',
        tags: [],
        skillRef: { skillId: '', mode: 'active' },
        expertiseRefs: [],
        expertiseFilter: { scope: [], emailType: null, language: null },
        input: {},
        providerOverride: {},
        groupContext: null,
      };
    },
    async submit() {
      if (!this.canSubmit) return;
      // Commit any pending v-combobox tag (see saveDetails in skill detail).
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      await this.$nextTick();
      this.saving = true;
      try {
        const created = await this.$axios.$post(
          api.aiPlaygroundScenarios(),
          this.scenario
        );
        this.showSnackbar({
          text: this.$t('aiPlayground.created'),
          color: 'success',
        });
        this.$router.push(`/ai-playground/${created.scenarioId}`);
      } catch (err) {
        const msg =
          (err.response && err.response.data && err.response.data.message) ||
          this.$t('global.errors.errorOccured');
        this.showSnackbar({ text: msg, color: 'error' });
      } finally {
        this.saving = false;
      }
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
        {{ $t('aiPlayground.actions.newScenario') }}
      </template>
      <template #actions>
        <v-btn
          color="accent"
          elevation="0"
          :loading="saving"
          :disabled="!canSubmit || saving"
          @click="submit"
        >
          {{ $t('global.create') }}
        </v-btn>
      </template>
    </bs-page-header>

    <v-container fluid>
      <bs-ai-playground-scenario-form
        :scenario="scenario"
        :expertise-mode="expertiseMode"
        :creating="true"
        :saving="saving"
        @update:expertise-mode="expertiseMode = $event"
        @input-valid="inputValid = $event"
      />
    </v-container>
  </div>
</template>
