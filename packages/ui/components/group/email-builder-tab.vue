<script>
import { mapMutations } from 'vuex';
import isEqual from 'lodash/isEqual';
import { groupsItem } from '~/helpers/api-routes.js';
import { emailMetadataErrorKeyFor } from '~/helpers/taxonomy.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

function emptyConfig() {
  return {
    enabled: false,
    requiredFields: [],
  };
}

export default {
  name: 'BsGroupEmailBuilderTab',
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
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

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
        this.showSnackbar({
          text: this.$t('emailBuilderSettings.snackbars.updated'),
          color: 'success',
        });
        this.$emit('update');
      } catch (error) {
        // Never the raw server message: it is an error code, or an untranslated
        // developer sentence.
        this.showSnackbar({
          text: this.$t(emailMetadataErrorKeyFor(error)),
          color: 'error',
        });
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
      <h3 class="settings-section__title">
        {{ $t('emailBuilderSettings.metadata.sectionTitle') }}
      </h3>
      <p class="settings-section__description">
        {{ $t('emailBuilderSettings.metadata.sectionDescription') }}
      </p>

      <v-switch
        :input-value="config.enabled"
        :label="$t('emailBuilderSettings.metadata.enabled')"
        :disabled="loading"
        color="accent"
        inset
        hide-details
        class="settings-section__switch"
        @change="onEnabledChange"
      />

      <p class="settings-section__hint">
        {{ $t('emailBuilderSettings.metadata.enabledHint') }}
      </p>

      <!-- On the SAVED state, not the edited one: announcing that the taxonomy
           page is available while the switch is still unsaved would be a lie the
           user can check in one click. -->
      <v-alert
        v-if="savedConfig.enabled"
        text
        dense
        type="info"
        class="settings-section__alert"
      >
        {{ $t('emailBuilderSettings.metadata.taxonomyHint') }}
        <v-btn :to="taxonomyRoute" small text color="accent" class="ml-2">
          {{ $t('emailBuilderSettings.metadata.taxonomyAction') }}
        </v-btn>
      </v-alert>
    </section>

    <div class="settings-actions">
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

  &__switch {
    margin-top: 0;
  }

  &__hint {
    color: var(--gray-700);
    font-size: 0.8125rem;
    margin: 0.5rem 0 0 0;
  }

  &__alert {
    margin-top: 1rem;
    font-size: 0.8125rem;
  }

  & + & {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--gray-300);
  }
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--gray-300);
}
</style>
