<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getProviderLabel } from '~/components/integrations/provider-configs';
import { LANGUAGE_OPTIONS } from '~/helpers/constants/languages.js';
import BsSelect from '~/components/form/bs-select.vue';
import { Languages, FileText, BadgeCheck } from 'lucide-vue';

const FORMALITY_OPTIONS = [
  { value: 'default', textKey: 'aiFeatures.translation.formalityDefault' },
  { value: 'more', textKey: 'aiFeatures.translation.formalityMore' },
  { value: 'less', textKey: 'aiFeatures.translation.formalityLess' },
  {
    value: 'prefer_more',
    textKey: 'aiFeatures.translation.formalityPreferMore',
  },
  {
    value: 'prefer_less',
    textKey: 'aiFeatures.translation.formalityPreferLess',
  },
];

export default {
  name: 'BsGroupAiFeaturesTab',
  components: {
    BsSelect,
    LucideLanguages: Languages,
    LucideFileText: FileText,
    LucideBadgeCheck: BadgeCheck,
  },
  props: {
    active: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      loading: false,
      saving: false,
      loadingModels: false,
      config: null,
      integrations: [],
      languageOptions: LANGUAGE_OPTIONS,
      dynamicModels: [],
      capabilities: null,
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
        if (!this.hasActiveIntegration) return false;
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
        if (value.length < 2) return;
        this.updateFeature('translation', {
          config: { availableLanguages: value },
        });
      },
    },
    languagesError() {
      const count = this.selectedLanguages.length;
      if (count > 0 && count < 2) {
        return this.$t('aiFeatures.translation.minLanguagesError');
      }
      return '';
    },
    hasActiveIntegration() {
      const integration = this.translationFeature?.integration;
      return integration && integration.isActive;
    },
    supportsModelSelection() {
      return this.capabilities?.supportsModelSelection || false;
    },
    supportsFormality() {
      return this.capabilities?.supportsFormality || false;
    },
    formalityOptions() {
      return FORMALITY_OPTIONS.map((opt) => ({
        value: opt.value,
        text: this.$t(opt.textKey),
      }));
    },
    modelOptions() {
      return this.dynamicModels.map((m) => {
        const name = m.name || m.id;
        const description = m.descriptionKey ? this.$t(m.descriptionKey) : '';
        return {
          value: m.id,
          text: description ? `${name} (${description})` : name,
        };
      });
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
    active(isActive) {
      if (isActive) {
        this.fetchData();
      }
    },
    selectedIntegrationId: {
      immediate: true,
      handler(newId) {
        if (newId) {
          this.loadModelsForIntegration(newId);
        } else {
          this.dynamicModels = [];
          this.capabilities = null;
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

    getProviderLabel,

    async loadModelsForIntegration(integrationId) {
      try {
        this.loadingModels = true;
        const response = await this.$axios.$get(
          apiRoutes.integrationModels(integrationId)
        );
        this.dynamicModels = response.models || [];
        this.capabilities = response.capabilities || null;
      } catch (error) {
        this.dynamicModels = [];
        this.capabilities = null;
        this.showSnackbar({
          text: this.$t('aiFeatures.errors.loadModelsFailed'),
          color: 'error',
        });
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
          class="mb-6"
        >
          {{ $t('aiFeatures.noIntegrationsWarning') }}
        </v-alert>

        <!-- Section: Translation Feature -->
        <div class="form-section">
          <div class="form-section__header">
            <div>
              <h3 class="form-section__title">
                <lucide-languages :size="20" class="mr-2" />
                {{ $t('aiFeatures.translation.title') }}
              </h3>
              <p class="form-section__description">
                {{ $t('aiFeatures.translation.description') }}
              </p>
            </div>
          </div>

          <!-- Activation switch -->
          <div class="activation-row mb-4">
            <v-switch
              v-model="translationIsActive"
              :label="$t('aiFeatures.translation.enableLabel')"
              :disabled="saving || !hasActiveIntegration"
              :loading="saving"
              color="accent"
              hide-details
              class="mt-0"
            />
          </div>

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

          <v-row>
            <v-col cols="12" md="6">
              <bs-select
                v-model="selectedIntegrationId"
                :items="integrationOptions"
                :label="$t('aiFeatures.selectIntegration')"
                :disabled="saving"
              />
            </v-col>

            <v-col v-if="supportsModelSelection && (modelOptions.length > 0 || loadingModels)" cols="12" md="6">
              <bs-select
                v-model="selectedModel"
                :items="modelOptions"
                :label="$t('aiFeatures.translation.model')"
                :hint="$t('aiFeatures.translation.modelHint')"
                :disabled="saving || !selectedIntegrationId || loadingModels"
              />
            </v-col>

            <v-col v-if="supportsFormality" cols="12" md="6">
              <bs-select
                v-model="selectedFormality"
                :items="formalityOptions"
                :label="$t('aiFeatures.translation.formality')"
                :hint="$t('aiFeatures.translation.formalityHint')"
                :disabled="saving || !selectedIntegrationId"
              />
            </v-col>

            <v-col cols="12" md="6">
              <bs-select
                v-model="selectedLanguages"
                :items="languageOptions"
                :label="$t('aiFeatures.translation.availableLanguages')"
                :hint="$t('aiFeatures.translation.languagesHint')"
                :error-messages="languagesError"
                :disabled="saving || !selectedIntegrationId"
                multiple
              />
            </v-col>
          </v-row>
        </div>

        <!-- Section: Coming Soon Features -->
        <div class="form-section">
          <h3 class="form-section__title">
            {{ $t('aiFeatures.upcomingFeatures') }}
          </h3>
          <p class="form-section__description">
            {{ $t('aiFeatures.upcomingFeaturesDescription') }}
          </p>

          <div class="upcoming-features">
            <div class="upcoming-feature">
              <lucide-file-text :size="20" class="upcoming-feature__icon" />
              <div class="upcoming-feature__content">
                <span class="upcoming-feature__title">
                  {{ $t('aiFeatures.textGeneration.title') }}
                </span>
                <span class="upcoming-feature__description">
                  {{ $t('aiFeatures.textGeneration.description') }}
                </span>
              </div>
              <v-chip x-small outlined color="grey">
                {{ $t('aiFeatures.comingSoon') }}
              </v-chip>
            </div>

            <div class="upcoming-feature">
              <lucide-badge-check :size="20" class="upcoming-feature__icon" />
              <div class="upcoming-feature__content">
                <span class="upcoming-feature__title">
                  {{ $t('aiFeatures.qualityCheck.title') }}
                </span>
                <span class="upcoming-feature__description">
                  {{ $t('aiFeatures.qualityCheck.description') }}
                </span>
              </div>
              <v-chip x-small outlined color="grey">
                {{ $t('aiFeatures.comingSoon') }}
              </v-chip>
            </div>
          </div>
        </div>
      </template>
    </v-card-text>
  </v-card>
</template>

<style lang="scss" scoped>
.form-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  &__header {
    margin-bottom: 1rem;
  }

  &__title {
    display: flex;
    align-items: center;
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    margin-bottom: 0.25rem;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0;
  }
}

.activation-row {
  display: flex;
  align-items: center;
}

.upcoming-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.upcoming-feature {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;

  &__icon {
    flex-shrink: 0;
    color: rgba(0, 0, 0, 0.4);
    margin-top: 2px;
  }

  &__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-weight: 500;
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.87);
  }

  &__description {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
    margin-top: 0.125rem;
  }
}
</style>