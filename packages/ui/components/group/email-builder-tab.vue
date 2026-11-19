<script>
import isEqual from 'lodash/isEqual';
import { groupsItem } from '~/helpers/api-routes.js';
import { emailMetadataErrorKeyFor } from '~/helpers/taxonomy.js';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';
import mixinInlineOutcome from '~/helpers/mixins/mixin-inline-outcome.js';
import BsSaveOutcome from '~/components/layout/bs-save-outcome.vue';

function emptyConfig() {
  return {
    enabled: false,
    requiredFields: [],
  };
}

export default {
  name: 'BsGroupEmailBuilderTab',
  components: {
    BsSaveOutcome,
    BsGroupFeatureSwitch,
  },
  mixins: [mixinInlineOutcome],
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return {
      // Edited copy: the switch must not appear to have taken effect before the
      // server confirms it.
      config: emptyConfig(),
      loading: false,
    };
  },
  computed: {
    hasUnsavedChanges() {
      // The whole section, not just `enabled`: `requiredFields` is already carried
      // in the local state and sent on save, so comparing only the switch would
      // silently discard the first setting added next to it.
      return !isEqual(this.config, this.normalizedSavedConfig);
    },
    savedConfig() {
      return this.group.emailMetadata || emptyConfig();
    },
    normalizedSavedConfig() {
      return {
        enabled: this.savedConfig.enabled === true,
        requiredFields: [...(this.savedConfig.requiredFields || [])],
      };
    },
    taxonomyRoute() {
      return `/groups/${this.group.id}/settings/taxonomy`;
    },
  },
  watch: {
    group: {
      immediate: true,
      handler(group) {
        const saved = (group && group.emailMetadata) || emptyConfig();
        this.config = {
          enabled: saved.enabled === true,
          requiredFields: [...(saved.requiredFields || [])],
        };
      },
    },
  },
  methods: {
    onEnabledChange(value) {
      this.config.enabled = Boolean(value);
    },

    async onSubmit() {
      this.loading = true;
      try {
        // Partial update: only the section this page owns travels, so saving here
        // cannot overwrite settings edited on another screen.
        await this.$axios.$put(groupsItem({ groupId: this.group.id }), {
          emailMetadata: this.config,
        });
        this.markSaved();
        this.$emit('update');
      } catch (error) {
        // Never the raw server message: it is an error code, or an untranslated
        // developer sentence.
        this.markFailed(this.$t(emailMetadataErrorKeyFor(error)));
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="email-builder-settings">
    <!-- One section per group of settings: `requiredFields` and the rest of the
         module's options land here as siblings, not as a rewrite of the page. -->
    <section class="settings-section">
      <div class="settings-section__header">
        <div>
          <h3 class="settings-section__title">
            {{ $t('emailBuilderSettings.metadata.sectionTitle') }}
          </h3>
          <p class="settings-section__description">
            {{ $t('emailBuilderSettings.metadata.sectionDescription') }}
          </p>
        </div>
        <bs-group-feature-switch
          :value="Boolean(config.enabled)"
          :label="$t('emailBuilderSettings.metadata.enabled')"
          :on-text="$t('emailBuilderSettings.metadata.on')"
          :off-text="$t('emailBuilderSettings.metadata.off')"
          :disabled="loading"
          @change="onEnabledChange"
        />
      </div>

      <p class="settings-section__hint">
        {{ $t('emailBuilderSettings.metadata.enabledHint') }}
      </p>

      <!-- Not conditioned on the switch: the taxonomy is configured independently
           of it, precisely so a company's typologies can be prepared before the
           metadata are turned on. The link is a signpost, not an unlock notice. -->
      <p class="settings-section__hint">
        {{ $t('emailBuilderSettings.metadata.taxonomyHint') }}
        <nuxt-link :to="taxonomyRoute" class="settings-section__link">
          {{ $t('emailBuilderSettings.metadata.taxonomyAction') }}
        </nuxt-link>
      </p>
    </section>

    <div class="settings-actions">
      <bs-save-outcome
        :outcome="outcome"
        :detail="outcomeDetail"
        @retry="onSubmit"
      />
      <v-btn
        color="accent"
        elevation="0"
        :loading="loading"
        :disabled="loading || !hasUnsavedChanges"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-section {
  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--gray-900);
    margin: 0 0 0.25rem 0;
  }

  &__description {
    color: var(--gray-700);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  &__hint {
    color: var(--gray-700);
    font-size: 0.8125rem;
    margin: 0.5rem 0 0 0;
  }

  &__link {
    color: var(--v-accent-base, #00acdc);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  & + & {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--gray-300);
  }
}

.settings-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-300);
}
</style>
