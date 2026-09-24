<script>
import BsCombobox from '~/components/form/bs-combobox';
import * as apiRoutes from '~/helpers/api-routes';
import { toModelId, isValidModelId } from '~/helpers/ai-model-picker';

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
      // Last rejected entry, kept only to explain itself on the field.
      invalidInput: null,
      // Bumped on every load and reset: only the latest request may write its
      // answer. Switching integrations quickly otherwise let a slower, older
      // response land last — the list and capabilities of the previous
      // provider shown for the new one, formality select included.
      loadSeq: 0,
    };
  },
  computed: {
    localValue: {
      get() {
        return this.value;
      },
      set(next) {
        const modelId = toModelId(next);
        if (!isValidModelId(modelId)) {
          // Held back rather than sent: the save would fail server-side, and
          // the tab would report it as a generic error. Saving is implicit
          // here — there is no button to grey out — so the message has to say
          // outright that nothing was recorded, or the admin walks away
          // believing the previous value was replaced.
          this.invalidInput = modelId;
          return;
        }
        this.invalidInput = null;
        this.$emit('input', modelId);
      },
    },
    supportsModelSelection() {
      return this.capabilities?.supportsModelSelection || false;
    },
    // Plain identifiers, not { value, text } objects. v-combobox ignores
    // `item-value` and hands the whole item back on selection, so objects here
    // meant an object reached the parent and was persisted as "[object
    // Object]". Strings also keep the field showing the identifier itself,
    // which is what the user edits when typing one by hand; the readable name
    // is rendered in the dropdown through the #item slot.
    items() {
      return this.models.map((model) => model.id);
    },
    modelsById() {
      return this.models.reduce((acc, model) => {
        acc[model.id] = model;
        return acc;
      }, {});
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
      // Describe the chosen model when we can. Providers differ: Mistral and
      // Gemini ship a written description, OpenAI and Anthropic ship none, so
      // the generic sentence stays as the fallback rather than leaving the
      // line empty half the time.
      return this.descriptionFor(this.value) || this.hint;
    },
    errorMessages() {
      return this.invalidInput ? this.$t('aiFeatures.model.invalidId') : '';
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
    labelFor(modelId) {
      const model = this.modelsById[modelId];
      if (!model) return modelId;
      const name = model.name || model.label || model.id;
      return model.deprecated
        ? `${name} — ${this.$t('aiFeatures.model.deprecated')}`
        : name;
    },
    /**
     * Written by the provider when it offers one, otherwise our own i18n key
     * for the models the catalogue describes.
     */
    descriptionFor(modelId) {
      const model = this.modelsById[modelId];
      if (!model) return '';
      if (model.description) return model.description;
      return model.descriptionKey ? this.$t(model.descriptionKey) : '';
    },

    reset() {
      this.loadSeq += 1;
      this.loading = false;
      this.models = [];
      this.defaultModel = null;
      this.capabilities = null;
      this.loadError = null;
      this.$emit('capabilities', null);
    },

    async loadModels(integrationId) {
      this.loadSeq += 1;
      const seq = this.loadSeq;
      const isStale = () => seq !== this.loadSeq;

      this.loading = true;
      this.loadError = null;
      try {
        const response = await this.$axios.$get(
          apiRoutes.integrationModels(integrationId)
        );
        if (isStale()) return;
        this.models = response.models || [];
        this.defaultModel = response.defaultModel || null;
        this.capabilities = response.capabilities || null;
        // Reported by the server when it had to fall back to the catalogue.
        this.loadError = response.error || null;
      } catch (error) {
        if (isStale()) return;
        // Shown on the field rather than raised as a snackbar: both sections
        // mount at once, and two stacked snackbars said nothing the field
        // could not. Free typing still works, so this is not a dead end.
        //
        // Capabilities are unknown here, and null would unmount the field —
        // taking the error message and the free-typing fallback with it. Nor
        // may the previous integration's be kept: they belong to another
        // provider. Model selection is assumed, so the admin keeps a field.
        this.models = [];
        this.defaultModel = null;
        this.capabilities = {
          supportsModelSelection: true,
          supportsFormality: false,
        };
        this.loadError = error.message || 'error';
      } finally {
        if (!isStale()) {
          this.loading = false;
          this.$emit('capabilities', this.capabilities);
        }
      }
    },
  },
};
</script>

<template>
  <bs-combobox
    v-if="integrationId && (supportsModelSelection || loadError)"
    v-model="localValue"
    :items="items"
    :label="label"
    :hint="effectiveHint"
    :error-messages="errorMessages"
    :placeholder="placeholder"
    :disabled="disabled || loading"
    :loading="loading"
    clearable
  >
    <!-- The stored value is the identifier; the readable name lives here so
         the two never diverge. -->
    <template #item="{ item, on, attrs }">
      <v-list-item v-bind="attrs" v-on="on">
        <v-list-item-content>
          <v-list-item-title>{{ labelFor(item) }}</v-list-item-title>
          <v-list-item-subtitle v-if="descriptionFor(item)">
            {{ descriptionFor(item) }}
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </template>
  </bs-combobox>
</template>
