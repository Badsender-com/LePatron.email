<script>
/**
 * BsAiFeatureSkillEngineSection
 *
 * Configures the generic "Skills" AI engine (AIFeatureConfig featureType
 * 'skill') for a group: integration + optional model + activation. This is the
 * engine every skill invocation resolves by default — and what the super-admin
 * AI Playground uses via the platform group.
 *
 * Self-contained: fetches its own config / integrations / models so the parent
 * tab only needs to drop <bs-ai-feature-skill-engine-section :group-id="..."/>.
 * Mirrors the translation section; when the étape 2bis hierarchy refactor lands,
 * the translation block can be extracted on the same model.
 */
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getProviderLabel } from '~/components/integrations/provider-configs';
import BsSelect from '~/components/form/bs-select.vue';
import BsAiModelPicker from '~/components/group/bs-ai-model-picker.vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import { Cpu } from 'lucide-vue';

const FEATURE_TYPE = 'skill';

export default {
  name: 'BsAiFeatureSkillEngineSection',
  components: {
    BsSelect,
    BsAiModelPicker,
    BsFormSection,
    LucideCpu: Cpu,
  },
  props: {
    groupId: { type: String, required: true },
    // When true, this section is the last in the tab (no bottom separator).
    last: { type: Boolean, default: false },
  },
  data() {
    return {
      loading: false,
      saving: false,
      config: null,
      integrations: [],
      // Reported by the model picker; drives whether its column is shown.
      capabilities: null,
    };
  },
  computed: {
    skillFeature() {
      return this.config?.features?.find((f) => f.featureType === FEATURE_TYPE);
    },
    integrationOptions() {
      return [
        { value: null, text: this.$t('aiFeatures.noIntegration') },
        ...this.integrations.map((i) => ({
          value: i._id,
          text: `${i.name} (${getProviderLabel(i.provider)})`,
        })),
      ];
    },
    hasActiveIntegration() {
      const integration = this.skillFeature?.integration;
      return integration && integration.isActive;
    },
    supportsModelSelection() {
      return this.capabilities?.supportsModelSelection || false;
    },
    selectedIntegrationId: {
      get() {
        return this.skillFeature?.integration?._id || null;
      },
      set(value) {
        // Clearing the model in the same call is required: updateFeatureConfig
        // only writes the fields it receives, so an OpenAI `gpt-4o` would
        // survive a switch to Mistral and be sent to the wrong provider.
        this.updateFeature({ integrationId: value, config: { model: null } });
      },
    },
    skillIsActive: {
      get() {
        if (!this.hasActiveIntegration) return false;
        return this.skillFeature?.isActive || false;
      },
      set(value) {
        this.updateFeature({ isActive: value });
      },
    },
    selectedModel: {
      get() {
        return this.skillFeature?.config?.model || null;
      },
      set(value) {
        this.updateFeature({ config: { model: value } });
      },
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async fetchData() {
      try {
        this.loading = true;
        const [configRes, integrationsRes] = await Promise.all([
          this.$axios.$get(apiRoutes.aiFeatures(this.groupId)),
          this.$axios.$get(apiRoutes.integrations(this.groupId, 'ai')),
        ]);
        this.config = configRes;
        this.integrations = integrationsRes.items || [];
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },

    async updateFeature(data) {
      try {
        this.saving = true;
        const result = await this.$axios.$put(
          apiRoutes.aiFeaturesItem(this.groupId, FEATURE_TYPE),
          data
        );
        this.config = result;
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        await this.fetchData();
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <bs-form-section :last="last">
    <template #icon>
      <lucide-cpu :size="20" />
    </template>
    <template #title>
      {{ $t('aiFeatures.skill.title') }}
    </template>
    <template #description>
      {{ $t('aiFeatures.skill.description') }}
    </template>

    <v-skeleton-loader v-if="loading" type="article" />

    <template v-else>
      <!-- Activation switch -->
      <div class="activation-row mb-4">
        <v-switch
          v-model="skillIsActive"
          :label="$t('aiFeatures.skill.enableLabel')"
          :disabled="saving || !hasActiveIntegration"
          :loading="saving"
          color="accent"
          hide-details
          class="mt-0"
        />
      </div>

      <!-- Warning if selected integration is inactive -->
      <v-alert
        v-if="selectedIntegrationId && !hasActiveIntegration"
        type="warning"
        dense
        outlined
        class="mb-4"
      >
        {{ $t('aiFeatures.integrationInactiveWarning') }}
      </v-alert>

      <v-row>
        <v-col cols="12" md="6">
          <bs-select
            v-model="selectedIntegrationId"
            :items="integrationOptions"
            :label="$t('aiFeatures.selectIntegration')"
            :disabled="saving"
          />
        </v-col>

        <v-col v-show="supportsModelSelection" cols="12" md="6">
          <bs-ai-model-picker
            v-model="selectedModel"
            :integration-id="selectedIntegrationId"
            :label="$t('aiFeatures.skill.model')"
            :hint="$t('aiFeatures.skill.modelHint')"
            :disabled="saving"
            @capabilities="capabilities = $event"
          />
        </v-col>
      </v-row>
    </template>
  </bs-form-section>
</template>

<style lang="scss" scoped>
.activation-row {
  display: flex;
  align-items: center;
}
</style>
