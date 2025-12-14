<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'BsMailingModalDuplicateTranslate',
  data() {
    return {
      show: false,
      loading: false,
      translating: false,
      mailing: null,
      config: {
        availableLanguages: [],
        hasActiveIntegration: false,
      },
      form: {
        newName: '',
        sourceLanguage: 'auto',
        targetLanguage: '',
      },
      languageLabels: {
        auto: 'Auto-detect',
        fr: 'Français',
        en: 'English',
        es: 'Español',
        de: 'Deutsch',
        it: 'Italiano',
        pt: 'Português',
        nl: 'Nederlands',
        pl: 'Polski',
        ru: 'Русский',
        ja: '日本語',
        zh: '中文',
        ar: 'العربية',
      },
      // Progress tracking
      jobId: null,
      pollInterval: null,
      progress: {
        status: null,
        currentBatch: 0,
        totalBatches: 0,
        keysTranslated: 0,
        totalKeys: 0,
      },
      // Time estimation
      batchTimes: [],
      estimatedTimeRemaining: null,
      cancelling: false,
    };
  },
  computed: {
    groupId() {
      const userState = this.$store.state.user;
      const info = userState && userState.info;
      return info && info.group && info.group.id;
    },
    mailingName() {
      return this.mailing ? this.mailing.name : '';
    },
    sourceLanguageOptions() {
      return [
        { value: 'auto', text: this.$t('translation.autoDetect') },
        ...this.config.availableLanguages.map((lang) => ({
          value: lang,
          text: this.languageLabels[lang] || lang,
        })),
      ];
    },
    targetLanguageOptions() {
      return this.config.availableLanguages
        .filter((lang) => lang !== this.form.sourceLanguage)
        .map((lang) => ({
          value: lang,
          text: this.languageLabels[lang] || lang,
        }));
    },
    isFormValid() {
      return (
        this.form.newName.trim() &&
        this.form.targetLanguage &&
        this.config.hasActiveIntegration
      );
    },
    nameRequired() {
      return (v) => (v && v.trim() ? true : this.$t('global.errors.required'));
    },
    progressPercent() {
      if (!this.progress.totalBatches) return 0;
      // Reserve last 10% for preview generation
      const batchPercent =
        (this.progress.currentBatch / this.progress.totalBatches) * 90;
      if (this.progress.status === 'generating_preview') {
        return 95;
      }
      if (this.progress.status === 'completed') {
        return 100;
      }
      return Math.round(batchPercent);
    },
    progressLabel() {
      if (this.progress.status === 'generating_preview') {
        return this.$t('translation.progressGeneratingPreview');
      }
      if (this.progress.status === 'completed') {
        return this.$t('translation.progressCompleted');
      }
      if (this.progress.totalBatches > 0) {
        return this.$t('translation.progressBatch', {
          current: this.progress.currentBatch,
          total: this.progress.totalBatches,
        });
      }
      return this.$t('translation.progressStarting');
    },
    hasProgress() {
      return this.translating && this.progress.totalBatches > 0;
    },
    estimatedTimeLabel() {
      if (!this.estimatedTimeRemaining || this.progress.currentBatch < 2) {
        return null;
      }
      const minutes = Math.floor(this.estimatedTimeRemaining / 60);
      const seconds = Math.round(this.estimatedTimeRemaining % 60);
      if (minutes > 0) {
        return this.$t('translation.estimatedTime', { minutes, seconds });
      }
      return this.$t('translation.estimatedTimeSeconds', { seconds });
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async open(mailing) {
      this.mailing = mailing;
      this.form.newName = `${mailing.name} - `;
      this.form.sourceLanguage = 'auto';
      this.form.targetLanguage = '';
      this.show = true;
      await this.fetchConfig();
    },

    close() {
      this.stopPolling();
      this.show = false;
      this.mailing = null;
      this.translating = false;
      this.jobId = null;
      this.progress = {
        status: null,
        currentBatch: 0,
        totalBatches: 0,
        keysTranslated: 0,
        totalKeys: 0,
      };
      this.batchTimes = [];
      this.estimatedTimeRemaining = null;
      this.cancelling = false;
    },

    startPolling(jobId) {
      this.jobId = jobId;
      this.pollInterval = setInterval(() => this.pollJobStatus(), 2000);
      // Also poll immediately
      this.pollJobStatus();
    },

    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    },

    async pollJobStatus() {
      if (!this.jobId) return;

      try {
        // Disable Nuxt progress bar for polling requests
        const job = await this.$axios.$get(
          apiRoutes.translationJobStatus(this.jobId),
          { progress: false }
        );

        // Track batch times for estimation
        const previousBatch = this.progress.currentBatch;
        const newBatch = job.progress.currentBatch;

        this.progress = {
          status: job.status,
          currentBatch: newBatch,
          totalBatches: job.progress.totalBatches,
          keysTranslated: job.progress.keysTranslated,
          totalKeys: job.progress.totalKeys,
        };

        // Record batch completion time for estimation
        if (newBatch > previousBatch && newBatch > this.batchTimes.length) {
          this.batchTimes.push(Date.now());
          this.calculateEstimate();
        }

        if (job.status === 'completed') {
          this.stopPolling();
          this.handleTranslationComplete(job.result);
        } else if (job.status === 'failed') {
          this.stopPolling();
          this.handleTranslationError(job.error);
        } else if (job.status === 'cancelled') {
          this.stopPolling();
          this.showSnackbar({
            text: this.$t('translation.cancelled'),
            color: 'info',
          });
          this.close();
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        // Don't stop polling on network errors, keep trying
      }
    },

    calculateEstimate() {
      if (this.batchTimes.length < 2) return;

      // Calculate average time per batch (in ms)
      const totalTime =
        this.batchTimes[this.batchTimes.length - 1] - this.batchTimes[0];
      const batchCount = this.batchTimes.length - 1;
      const avgTimePerBatch = totalTime / batchCount;

      // Remaining batches
      const remainingBatches =
        this.progress.totalBatches - this.progress.currentBatch;

      // Add ~10s for Puppeteer preview generation
      const puppeteerEstimate = 10000;

      // Estimation in seconds
      this.estimatedTimeRemaining =
        (remainingBatches * avgTimePerBatch + puppeteerEstimate) / 1000;
    },

    handleTranslationComplete() {
      this.showSnackbar({
        text: this.$t('translation.success'),
        color: 'success',
      });

      this.$emit('translated');
      this.$emit('show-warning');
      this.close();
    },

    handleTranslationError(errorMessage) {
      this.showSnackbar({
        text: errorMessage || this.$t('global.errors.errorOccured'),
        color: 'error',
      });
      this.translating = false;
    },

    async handleCancel() {
      if (!this.jobId || this.cancelling) return;

      try {
        this.cancelling = true;
        await this.$axios.$post(apiRoutes.translationJobCancel(this.jobId));
        this.stopPolling();
        this.showSnackbar({
          text: this.$t('translation.cancelled'),
          color: 'info',
        });
        this.close();
      } catch (error) {
        console.error('Cancel failed:', error);
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        this.cancelling = false;
      }
    },

    async fetchConfig() {
      if (!this.groupId) return;
      try {
        this.loading = true;
        const config = await this.$axios.$get(
          apiRoutes.aiFeatures(this.groupId)
        );
        const features = config && config.features ? config.features : [];
        const translationFeature = features.find(
          (f) => f.featureType === 'translation'
        );
        const featureConfig = translationFeature && translationFeature.config;
        const integration =
          translationFeature && translationFeature.integration;
        this.config = {
          availableLanguages:
            (featureConfig && featureConfig.availableLanguages) || [],
          hasActiveIntegration:
            translationFeature &&
            translationFeature.isActive &&
            integration &&
            integration.isActive,
        };

        // Pre-select first available language if only one
        if (this.config.availableLanguages.length === 1) {
          this.form.targetLanguage = this.config.availableLanguages[0];
        }
      } catch (error) {
        console.error('Error fetching translation config:', error);
        this.config = {
          availableLanguages: [],
          hasActiveIntegration: false,
        };
      } finally {
        this.loading = false;
      }
    },

    updateNewName() {
      if (this.form.targetLanguage && this.mailing) {
        const langLabel =
          this.languageLabels[this.form.targetLanguage] ||
          this.form.targetLanguage.toUpperCase();
        this.form.newName = `${this.mailing.name} - ${langLabel}`;
      }
    },

    async handleTranslate() {
      if (!this.isFormValid || !this.mailing) return;

      try {
        this.translating = true;
        const payload = {
          targetLanguage: this.form.targetLanguage,
          newName: this.form.newName.trim(),
        };

        if (this.form.sourceLanguage !== 'auto') {
          payload.sourceLanguage = this.form.sourceLanguage;
        }

        // Start async translation and get jobId
        const response = await this.$axios.$post(
          apiRoutes.mailingDuplicateTranslate(this.mailing.id),
          payload
        );

        // Start polling for progress
        if (response && response.jobId) {
          this.startPolling(response.jobId);
        } else {
          // Fallback for old API response (shouldn't happen)
          this.showSnackbar({
            text: this.$t('translation.success'),
            color: 'success',
          });
          this.$emit('translated');
          this.$emit('show-warning');
          this.close();
        }
      } catch (error) {
        const errorResponse = error.response && error.response.data;
        const message =
          (errorResponse && errorResponse.message) ||
          this.$t('global.errors.errorOccured');
        this.showSnackbar({
          text: message,
          color: 'error',
        });
        this.translating = false;
      }
    },
  },
  watch: {
    'form.targetLanguage': 'updateNewName',
  },
};
</script>

<template>
  <v-dialog v-model="show" max-width="550" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon left color="primary">
          mdi-translate
        </v-icon>
        {{ $t('translation.duplicateAndTranslate') }}
      </v-card-title>

      <v-card-text>
        <v-skeleton-loader v-if="loading" type="article" />

        <template v-else>
          <!-- No integration warning -->
          <v-alert
            v-if="!config.hasActiveIntegration"
            type="warning"
            dense
            outlined
            class="mb-4"
          >
            {{ $t('translation.noActiveIntegration') }}
          </v-alert>

          <!-- No languages configured -->
          <v-alert
            v-else-if="config.availableLanguages.length === 0"
            type="info"
            dense
            outlined
            class="mb-4"
          >
            {{ $t('translation.noLanguagesConfigured') }}
          </v-alert>

          <template v-else>
            <!-- Progress display when translating -->
            <template v-if="translating">
              <p class="text--secondary mb-4">
                {{ $t('translation.translatingNotice') }}
              </p>

              <v-progress-linear
                :value="progressPercent"
                color="primary"
                height="24"
                striped
                class="mb-2"
              >
                <template #default>
                  <span class="white--text text-caption font-weight-medium">
                    {{ progressPercent }}%
                  </span>
                </template>
              </v-progress-linear>

              <p class="text-center text--secondary mb-0">
                {{ progressLabel }}
                <span v-if="estimatedTimeLabel" class="ml-1">
                  ({{ estimatedTimeLabel }})
                </span>
              </p>
            </template>

            <!-- Form when not translating -->
            <template v-else>
              <p
                class="text--secondary mb-4"
                v-html="
                  $t('translation.duplicateNotice', { name: mailingName })
                "
              />

              <!-- Source Language -->
              <v-select
                v-model="form.sourceLanguage"
                :items="sourceLanguageOptions"
                :label="$t('translation.sourceLanguage')"
                :disabled="translating"
                outlined
                dense
                class="mb-2"
              />

              <!-- Target Language -->
              <v-select
                v-model="form.targetLanguage"
                :items="targetLanguageOptions"
                :label="$t('translation.targetLanguage')"
                :disabled="translating"
                :rules="[(v) => !!v || $t('global.errors.required')]"
                outlined
                dense
                class="mb-2"
              />

              <!-- New Name -->
              <v-text-field
                v-model="form.newName"
                :label="$t('translation.newName')"
                :disabled="translating"
                :rules="[nameRequired]"
                outlined
                dense
              />
            </template>
          </template>
        </template>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn v-if="!translating" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          v-if="!translating"
          color="primary"
          :disabled="!isFormValid"
          @click="handleTranslate"
        >
          <v-icon left>
            mdi-translate
          </v-icon>
          {{ $t('translation.translate') }}
        </v-btn>
        <v-btn
          v-if="translating"
          text
          color="error"
          :disabled="cancelling"
          :loading="cancelling"
          @click="handleCancel"
        >
          {{ $t('global.cancel') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
