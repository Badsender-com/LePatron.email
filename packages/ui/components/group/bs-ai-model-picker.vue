<script>
import BsCombobox from '~/components/form/bs-combobox';
import * as apiRoutes from '~/helpers/api-routes';

/**
 * BsAiModelPicker - model selection for one AI feature.
 *
 * Owns the whole "which model" concern: it loads the list for the given
 * integration, renders it, and reports the provider capabilities back up. Both
 * settings sections used to carry their own near-identical copy of this.
 *
 * A combobox rather than a select, because the list is never guaranteed
 * exhaustive: models ship between deploys, Azure deployment names are chosen
 * by the customer, and self-hosted endpoints answer for whatever they like.
 * Typing an identifier the list does not contain is a supported action; the
 * server validates its shape, not its membership.
 *
 * Clearing the field means "use the provider default" — hence `clearable`
 * plus the default spelled out in the placeholder, rather than a null option
 * in the list.
 */
export default {
  name: 'BsAiModelPicker',
  components: { BsCombobox },
  props: {
    /** Configured model id, or null for the provider default. */
    value: { type: String, default: null },
    integrationId: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
  },
  data() {
    return {
      models: [],
      defaultModel: null,
      capabilities: null,
      loading: false,
      loadError: null,
    };
  },
  computed: {
    localValue: {
      get() {
        return this.value;
      },
      set(next) {
        // The combobox yields '' when cleared and null when the clear icon is
        // used. Both mean "provider default"; '' would otherwise be persisted
        // and win over the default downstream.
        const trimmed = typeof next === 'string' ? next.trim() : next;
        this.$emit('input', trimmed || null);
      },
    },
    supportsModelSelection() {
      return this.capabilities?.supportsModelSelection || false;
    },
    items() {
      return this.models.map((model) => {
        const name = model.name || model.label || model.id;
        const description = model.descriptionKey
          ? this.$t(model.descriptionKey)
          : '';
        const suffix = model.deprecated
          ? ` — ${this.$t('aiFeatures.model.deprecated')}`
          : '';
        return {
          value: model.id,
          text: description
            ? `${name} (${description})${suffix}`
            : `${name}${suffix}`,
        };
      });
    },
    placeholder() {
      return this.defaultModel
        ? this.$t('aiFeatures.model.defaultOption', {
            model: this.defaultModel,
          })
        : this.$t('aiFeatures.model.defaultOptionUnknown');
    },
    /** Warn when the configured model is not one the provider offered. */
    isCustomValue() {
      if (!this.value) return false;
      return !this.models.some((model) => model.id === this.value);
    },
    effectiveHint() {
      if (this.loadError) return this.$t('aiFeatures.model.loadFailed');
      if (this.isCustomValue) return this.$t('aiFeatures.model.customHint');
      return this.hint;
    },
  },
  watch: {
    integrationId: {
      immediate: true,
      handler(next) {
        if (next) {
          this.loadModels(next);
        } else {
          this.reset();
        }
      },
    },
  },
  methods: {
    reset() {
      this.models = [];
      this.defaultModel = null;
      this.capabilities = null;
      this.loadError = null;
      this.$emit('capabilities', null);
    },

    async loadModels(integrationId, { refresh = false } = {}) {
      this.loading = true;
      this.loadError = null;
      try {
        const route = apiRoutes.integrationModels(integrationId);
        const response = await this.$axios.$get(
          refresh ? `${route}?refresh=true` : route
        );
        this.models = response.models || [];
        this.defaultModel = response.defaultModel || null;
        this.capabilities = response.capabilities || null;
        // Reported by the server when it had to fall back to the catalogue.
        this.loadError = response.error || null;
      } catch (error) {
        // Shown on the field rather than raised as a snackbar: both sections
        // mount at once, and two stacked snackbars said nothing the field
        // could not. Free typing still works, so this is not a dead end.
        this.models = [];
        this.defaultModel = null;
        this.capabilities = null;
        this.loadError = error.message || 'error';
      } finally {
        this.loading = false;
        this.$emit('capabilities', this.capabilities);
      }
    },

    refresh() {
      if (this.integrationId) {
        this.loadModels(this.integrationId, { refresh: true });
      }
    },
  },
};
</script>

<template>
  <bs-combobox
    v-if="integrationId && supportsModelSelection"
    v-model="localValue"
    :items="items"
    :label="label"
    :hint="effectiveHint"
    :placeholder="placeholder"
    :disabled="disabled || loading"
    :loading="loading"
    item-text="text"
    item-value="value"
    :return-object="false"
    clearable
  />
</template>
