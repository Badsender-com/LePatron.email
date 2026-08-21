<script>
import { mapMutations } from 'vuex';
import { groupsItem } from '~/helpers/api-routes.js';
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
      return this.config.enabled !== this.savedConfig.enabled;
    },
    savedConfig() {
      return this.group.emailMetadata || emptyConfig();
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
        const message =
          (error.response &&
            error.response.data &&
            error.response.data.message) ||
          this.$t('emailBuilderSettings.snackbars.error');
        this.showSnackbar({ text: message, color: 'error' });
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

      <v-alert
        v-if="config.enabled"
        text
        dense
        type="info"
        class="settings-section__alert"
      >
        {{ $t('emailBuilderSettings.metadata.taxonomyHint') }}
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
    font-size: 16px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    margin: 0 0 4px 0;
  }

  &__description {
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
    margin-bottom: 16px;
  }

  &__switch {
    margin-top: 0;
  }

  &__hint {
    color: rgba(0, 0, 0, 0.6);
    font-size: 13px;
    margin: 8px 0 0 0;
  }

  &__alert {
    margin-top: 16px;
    font-size: 13px;
  }

  & + & {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
  }
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
