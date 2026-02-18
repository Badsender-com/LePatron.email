<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { LANGUAGE_OPTIONS } from '~/helpers/constants/languages.js';

// Fallback static models by provider (used when dynamic fetch fails)
const FALLBACK_MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4o-mini', text: 'GPT-4o Mini (fast, economical)' },
    { value: 'gpt-4o', text: 'GPT-4o (balanced)' },
    { value: 'gpt-4-turbo', text: 'GPT-4 Turbo (powerful)' },
  ],
  mistral: [
    { value: 'mistral-small-latest', text: 'Mistral Small (fast)' },
    { value: 'mistral-medium-latest', text: 'Mistral Medium (balanced)' },
    { value: 'mistral-large-latest', text: 'Mistral Large (powerful)' },
  ],
};

// DeepL formality options
const DEEPL_FORMALITY_OPTIONS = [
  { value: 'default', textKey: 'aiFeatures.translation.formalityDefault' },
  { value: 'more', textKey: 'aiFeatures.translation.formalityMore' },
  { value: 'less', textKey: 'aiFeatures.translation.formalityLess' },
  { value: 'prefer_more', textKey: 'aiFeatures.translation.formalityPreferMore' },
  { value: 'prefer_less', textKey: 'aiFeatures.translation.formalityPreferLess' },
];

export default {
  name: 'BsGroupAiFeaturesTab',
  data() {
    return {
      loading: false,
      saving: false,
      loadingModels: false,
      config: null,
      integrations: [],
      languageOptions: LANGUAGE_OPTIONS,
      dynamicModels: [], // Models fetched from API
      modelsDynamic: false, // Whether models were fetched dynamically
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    translationFeature() {
      return this.config?.features?.find(
        (f) => f.featureType === 'translation'
      );
    },
    integrationOptions() {
      return [
        { value: null, text: this.$t('aiFeatures.noIntegration') },
        ...this.integrations.map((i) => ({
          value: i._id,
          text: `${i.name} (${this.getProviderLabel(i.provider)})`,
        })),
      ];
    },
    selectedIntegrationId: {
      get() {
        return this.translationFeature?.integration?._id || null;
      },
      set(value) {
        this.updateFeature('translation', { integrationId: value });
      },
    },
    translationIsActive: {
      get() {
        return this.translationFeature?.isActive || false;
      },
      set(value) {
        this.updateFeature('translation', { isActive: value });
      },
    },
    selectedLanguages: {
      get() {
        return this.translationFeature?.config?.availableLanguages || [];
      },
      set(value) {
        this.updateFeature('translation', {
          config: { availableLanguages: value },
        });
      },
    },
    hasActiveIntegration() {
      const integration = this.translationFeature?.integration;
      return integration && integration.isActive;
    },
    selectedIntegrationProvider() {
      const integrationId = this.selectedIntegrationId;
      if (!integrationId) return null;
      const integration = this.integrations.find(
        (i) => i._id === integrationId
      );
      return integration ? integration.provider : null;
    },
    isDeepLProvider() {
      return this.selectedIntegrationProvider === 'deepl';
    },
    formalityOptions() {
      return DEEPL_FORMALITY_OPTIONS.map((opt) => ({
        value: opt.value,
        text: this.$t(opt.textKey),
      }));
    },
    modelOptions() {
      // Use dynamic models if available
      if (this.dynamicModels.length > 0) {
        return this.dynamicModels.map((m) => ({
          value: m.id,
          text: m.name || m.id,
        }));
      }
      // Fallback to static models
      const provider = this.selectedIntegrationProvider;
      if (!provider || !FALLBACK_MODEL_OPTIONS[provider]) return [];
      return FALLBACK_MODEL_OPTIONS[provider];
    },
    selectedModel: {
      get() {
        return this.translationFeature?.config?.model || null;
      },
      set(value) {
        this.updateFeature('translation', {
          config: { model: value },
        });
      },
    },
    selectedFormality: {
      get() {
        return this.translationFeature?.config?.formality || 'default';
      },
      set(value) {
        this.updateFeature('translation', {
          config: { formality: value },
        });
      },
    },
  },
  watch: {
    selectedIntegrationId: {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.loadModelsForIntegration(newId);
        } else {
          this.dynamicModels = [];
          this.modelsDynamic = false;
        }
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
          this.$axios.$get(apiRoutes.integrations(this.groupId)),
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

    async updateFeature(featureType, data) {
      try {
        this.saving = true;
        const result = await this.$axios.$put(
          apiRoutes.aiFeaturesItem(this.groupId, featureType),
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
        // Refresh to reset UI state
        await this.fetchData();
      } finally {
        this.saving = false;
      }
    },

    getProviderLabel(provider) {
      const labels = {
        openai: 'OpenAI',
        mistral: 'Mistral AI',
        infomaniak: 'Infomaniak AI Tools',
        deepl: 'DeepL',
      };
      return labels[provider] || provider;
    },

    async loadModelsForIntegration(integrationId) {
      if (!integrationId) {
        this.dynamicModels = [];
        this.modelsDynamic = false;
        return;
      }
      try {
        this.loadingModels = true;
        const response = await this.$axios.$get(
          apiRoutes.integrationModels(integrationId)
        );
        this.dynamicModels = response.models || [];
        this.modelsDynamic = response.dynamic || false;
      } catch (error) {
        console.error('Failed to load models:', error);
        // Fall back to static models
        this.dynamicModels = [];
        this.modelsDynamic = false;
      } finally {
        this.loadingModels = false;
      }
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <v-skeleton-loader v-if="loading" type="article" />

      <template v-else>
        <!-- No integrations warning -->
        <v-alert
          v-if="integrations.length === 0"
          type="info"
          outlined
          class="mb-4"
        >
          {{ $t('aiFeatures.noIntegrationsWarning') }}
        </v-alert>

        <!-- Translation Feature -->
        <v-card outlined class="mb-4">
          <v-card-title class="d-flex align-center">
            <v-icon left>
              mdi-translate
            </v-icon>
            {{ $t('aiFeatures.translation.title') }}
            <v-spacer />
            <v-switch
              v-model="translationIsActive"
              :disabled="saving || !hasActiveIntegration"
              :loading="saving"
              hide-details
              class="mt-0"
            />
          </v-card-title>

          <v-card-text>
            <p class="text--secondary mb-4">
              {{ $t('aiFeatures.translation.description') }}
            </p>

            <!-- Integration Selection -->
            <v-select
              v-model="selectedIntegrationId"
              :items="integrationOptions"
              :label="$t('aiFeatures.selectIntegration')"
              :disabled="saving"
              :loading="saving"
              outlined
              dense
              class="mb-4"
            />

            <!-- Warning if no active integration selected -->
            <v-alert
              v-if="selectedIntegrationId && !hasActiveIntegration"
              type="warning"
              dense
              outlined
              class="mb-4"
            >
              {{ $t('aiFeatures.integrationInactiveWarning') }}
            </v-alert>

            <!-- Model Selection (for LLM providers) -->
            <v-select
              v-if="!isDeepLProvider && (modelOptions.length > 0 || loadingModels)"
              v-model="selectedModel"
              :items="modelOptions"
              :label="$t('aiFeatures.translation.model')"
              :disabled="saving || !selectedIntegrationId || loadingModels"
              :loading="saving || loadingModels"
              outlined
              dense
              class="mb-4"
              :hint="$t('aiFeatures.translation.modelHint')"
              persistent-hint
            />

            <!-- Formality Selection (for DeepL only) -->
            <v-select
              v-if="isDeepLProvider"
              v-model="selectedFormality"
              :items="formalityOptions"
              :label="$t('aiFeatures.translation.formality')"
              :disabled="saving || !selectedIntegrationId"
              :loading="saving"
              outlined
              dense
              class="mb-4"
              :hint="$t('aiFeatures.translation.formalityHint')"
              persistent-hint
            />

            <!-- Language Configuration -->
            <v-select
              v-model="selectedLanguages"
              :items="languageOptions"
              :label="$t('aiFeatures.translation.availableLanguages')"
              :disabled="saving || !selectedIntegrationId"
              :loading="saving"
              multiple
              chips
              small-chips
              deletable-chips
              outlined
              dense
              :hint="$t('aiFeatures.translation.languagesHint')"
              persistent-hint
            />
          </v-card-text>
        </v-card>

        <!-- Future Features Placeholder -->
        <v-card outlined disabled class="mb-4">
          <v-card-title class="d-flex align-center text--disabled">
            <v-icon left disabled>
              mdi-text-box-edit
            </v-icon>
            {{ $t('aiFeatures.textGeneration.title') }}
            <v-spacer />
            <v-chip small outlined>
              {{ $t('aiFeatures.comingSoon') }}
            </v-chip>
          </v-card-title>
          <v-card-text class="text--disabled">
            {{ $t('aiFeatures.textGeneration.description') }}
          </v-card-text>
        </v-card>

        <v-card outlined disabled>
          <v-card-title class="d-flex align-center text--disabled">
            <v-icon left disabled>
              mdi-check-decagram
            </v-icon>
            {{ $t('aiFeatures.qualityCheck.title') }}
            <v-spacer />
            <v-chip small outlined>
              {{ $t('aiFeatures.comingSoon') }}
            </v-chip>
          </v-card-title>
          <v-card-text class="text--disabled">
            {{ $t('aiFeatures.qualityCheck.description') }}
          </v-card-text>
        </v-card>
      </template>
    </v-card-text>
  </v-card>
</template>
