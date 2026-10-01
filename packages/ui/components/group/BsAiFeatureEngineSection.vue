<script>
/**
 * BsAiFeatureEngineSection
 *
 * Configures one skill-backed AI feature of a group (an AIFeatureConfig entry):
 * integration + optional model + activation. Used for:
 * - 'skill', the engine skill invocations resolve by default — and what the
 *   super-admin AI Playground uses via the platform group;
 * - 'text_generation', the engine of the editor's text generation (subject,
 *   preheader).
 *
 * Self-contained: fetches its own config / integrations / models so the parent
 * tab only needs to drop
 * <bs-ai-feature-engine-section feature-type="..." labels="..." :group-id="..."/>.
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

export default {
  name: 'BsAiFeatureEngineSection',
  components: {
    BsSelect,
    BsAiModelPicker,
    BsFormSection,
    LucideCpu: Cpu,
  },
  props: {
    groupId: { type: String, required: true },
    // The AIFeatureConfig entry this section edits.
    featureType: { type: String, required: true },
    // Locale namespace holding title, description, enableLabel, model and
    // modelHint (e.g. 'aiFeatures.skill').
    labels: { type: String, required: true },
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
    feature() {
      return this.config?.features?.find(
        (f) => f.featureType === this.featureType
      );
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
      const integration = this.feature?.integration;
      return integration && integration.isActive;
    },
    supportsModelSelection() {
      return this.capabilities?.supportsModelSelection || false;
    },
    selectedIntegrationId: {
      get() {
        return this.feature?.integration?._id || null;
      },
      set(value) {
        // Clearing the model in the same call is required: updateFeatureConfig
        // only writes the fields it receives, so an OpenAI `gpt-4o` would
        // survive a switch to Mistral and be sent to the wrong provider.
        this.updateFeature({ integrationId: value, config: { model: null } });
      },
    },
    featureIsActive: {
      get() {
        if (!this.hasActiveIntegration) return false;
        return this.feature?.isActive || false;
      },
      set(value) {
        this.updateFeature({ isActive: value });
      },
    },
    selectedModel: {
      get() {
        return this.feature?.config?.model || null;
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
          apiRoutes.aiFeaturesItem(this.groupId, this.featureType),
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
      <slot name="icon">
        <lucide-cpu :size="20" />
      </slot>
    </template>
    <template #title>
      {{ $t(`${labels}.title`) }}
    </template>
    <template #description>
      {{ $t(`${labels}.description`) }}
    </template>

    <v-skeleton-loader v-if="loading" type="article" />

    <template v-else>
      <!-- Activation switch -->
      <div class="activation-row mb-4">
        <v-switch
          v-model="featureIsActive"
          :label="$t(`${labels}.enableLabel`)"
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
            :label="$t(`${labels}.model`)"
            :hint="$t(`${labels}.modelHint`)"
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
