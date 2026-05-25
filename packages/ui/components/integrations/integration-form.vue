<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import {
  getProviderFormConfig,
  getProviderLabel,
  getProvidersGroupedByCategory,
} from './provider-configs';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';
import { Eye, EyeOff } from 'lucide-vue';

export default {
  name: 'BsIntegrationForm',
  mixins: [validationMixin],
  components: {
    BsTextField,
    BsSelect,
    LucideEye: Eye,
    LucideEyeOff: EyeOff,
  },
  props: {
    integration: {
      type: Object,
      default: null,
    },
    providers: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      form: {
        name: '',
        type: 'ai',
        provider: '',
        apiKey: '',
        apiHost: '',
        productId: '',
        isActive: true,
      },
      showApiKey: false,
    };
  },
  computed: {
    isEdit() {
      return !!this.integration;
    },
    title() {
      return this.isEdit
        ? this.$t('integrations.edit')
        : this.$t('integrations.add');
    },
    /**
     * Build grouped items for v-select with headers.
     * Format: [{ header: 'Category' }, { value, text, icon }, ...]
     */
    groupedProviderOptions() {
      const groups = getProvidersGroupedByCategory(this.providers);
      const items = [];

      for (const group of groups) {
        // Add category header
        items.push({
          header: this.$t(group.category.labelKey),
        });

        // Add providers in this category
        for (const provider of group.providers) {
          items.push({
            value: provider.key,
            text: provider.label,
            icon: group.category.icon,
          });
        }
      }

      return items;
    },
    selectedProviderConfig() {
      return getProviderFormConfig(this.form.provider);
    },
    apiKeyLabel() {
      if (this.selectedProviderConfig.apiKeyLabelKey) {
        return this.$t(this.selectedProviderConfig.apiKeyLabelKey);
      }
      return this.$t('integrations.apiKey');
    },
    showProductIdField() {
      return this.selectedProviderConfig.showProductId === true;
    },
  },
  watch: {
    integration: {
      immediate: true,
      handler(val) {
        if (val) {
          this.form = {
            name: val.name || '',
            type: val.type || 'ai',
            provider: val.provider || '',
            apiKey: '', // Never pre-fill API key for security
            apiHost: val.apiHost || '',
            productId: val.productId || '',
            isActive: val.isActive !== false,
          };
        } else {
          this.resetForm();
        }
      },
    },
    'form.provider'(newProvider) {
      // Auto-set type based on provider config (e.g., 'dashboard' for Metabase)
      if (newProvider && !this.isEdit) {
        const config = getProviderFormConfig(newProvider);
        if (config.type) {
          this.form.type = config.type;
        } else {
          this.form.type = 'ai'; // Default to 'ai' for AI providers
        }
      }
    },
  },
  validations() {
    const rules = {
      form: {
        name: { required },
        provider: { required },
      },
    };
    // API key required only for new integrations
    if (!this.isEdit) {
      rules.form.apiKey = { required };
    }
    if (this.showProductIdField) {
      rules.form.productId = { required };
    }
    return rules;
  },
  methods: {
    resetForm() {
      this.form = {
        name: '',
        type: 'ai',
        provider: '',
        apiKey: '',
        apiHost: '',
        productId: '',
        isActive: true,
      };
      this.$v.$reset();
    },

    getProviderLabel,

    fieldErrors(fieldName) {
      const field = this.$v.form[fieldName];
      if (!field || !field.$dirty) return [];
      if (!field.required) return [this.$t('global.errors.required')];
      return [];
    },

    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const data = {
        name: this.form.name,
        type: this.form.type,
        provider: this.form.provider,
        isActive: this.form.isActive,
      };

      // Only include API key if provided (for updates, it's optional)
      if (this.form.apiKey) {
        data.apiKey = this.form.apiKey;
      }

      // Only include apiHost if provided
      if (this.form.apiHost) {
        data.apiHost = this.form.apiHost;
      }

      // Include productId for Infomaniak
      if (this.form.productId) {
        data.productId = this.form.productId;
      }

      this.$emit('save', data);
    },

    onCancel() {
      this.resetForm();
      this.$emit('cancel');
    },
  },
};
</script>

<template>
  <v-card>
    <v-card-title>
      <span class="headline">{{ title }}</span>
    </v-card-title>

    <v-card-text>
      <v-form @submit.prevent="onSubmit">
        <bs-text-field
          v-model="form.name"
          :label="$t('integrations.name')"
          :error-messages="fieldErrors('name')"
          :disabled="loading"
          required
          @blur="$v.form.name.$touch()"
        />

        <bs-select
          v-model="form.provider"
          :items="groupedProviderOptions"
          :label="$t('integrations.provider')"
          :error-messages="fieldErrors('provider')"
          :disabled="loading || isEdit"
          required
          @blur="$v.form.provider.$touch()"
        />

        <div class="bs-text-field">
          <label class="bs-text-field__label">
            {{ apiKeyLabel }}
            <span v-if="!isEdit" class="bs-text-field__required">*</span>
          </label>
          <v-text-field
            v-model="form.apiKey"
            :placeholder="
              selectedProviderConfig.apiKeyPlaceholderKey
                ? $t(selectedProviderConfig.apiKeyPlaceholderKey)
                : ''
            "
            :error-messages="fieldErrors('apiKey')"
            :disabled="loading"
            :type="showApiKey ? 'text' : 'password'"
            solo
            flat
            hide-details="auto"
            class="bs-text-field__input"
            @blur="$v.form.apiKey && $v.form.apiKey.$touch()"
          >
            <template #append>
              <v-btn icon small @click="showApiKey = !showApiKey">
                <lucide-eye-off v-if="showApiKey" :size="18" />
                <lucide-eye v-else :size="18" />
              </v-btn>
            </template>
          </v-text-field>
          <div v-if="isEdit" class="bs-text-field__hint">
            {{ $t('integrations.apiKeyHintEdit') }}
          </div>
        </div>

        <bs-text-field
          v-if="showProductIdField"
          v-model="form.productId"
          :label="$t('integrations.productId')"
          :error-messages="fieldErrors('productId')"
          :hint="
            selectedProviderConfig.productIdHintKey
              ? $t(selectedProviderConfig.productIdHintKey)
              : ''
          "
          :disabled="loading"
          required
          @blur="$v.form.productId && $v.form.productId.$touch()"
        />

        <bs-text-field
          v-if="selectedProviderConfig.apiHostPlaceholder"
          v-model="form.apiHost"
          :label="$t('integrations.apiHost')"
          :placeholder="selectedProviderConfig.apiHostPlaceholder"
          :hint="
            selectedProviderConfig.apiHostHintKey
              ? $t(selectedProviderConfig.apiHostHintKey)
              : ''
          "
          :disabled="loading"
        />

        <v-switch
          v-model="form.isActive"
          :label="$t('integrations.active')"
          :disabled="loading"
          color="accent"
        />
      </v-form>
    </v-card-text>

    <v-divider />
    <div class="modal-actions">
      <v-btn text color="primary" :disabled="loading" @click="onCancel">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn color="accent" elevation="0" :loading="loading" @click="onSubmit">
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </v-card>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
}

.bs-text-field {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__required {
    color: #f04e23;
    margin-left: 2px;
  }

  &__input {
    &.v-text-field.v-text-field--solo {
      ::v-deep .v-input__slot {
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        background: #fff;
        min-height: 40px;
        padding: 0 12px;
        transition: border-color 0.2s ease;

        &:hover {
          border-color: rgba(0, 0, 0, 0.4);
        }
      }

      &.v-input--is-focused ::v-deep .v-input__slot {
        border-color: #00acdc;
      }

      &.error--text ::v-deep .v-input__slot {
        border-color: #f04e23;
      }

      ::v-deep input {
        font-size: 0.875rem;
        padding: 8px 0;
      }

      ::v-deep .v-text-field__details {
        padding: 4px 0 0 0;
        min-height: auto;
      }

      ::v-deep .v-messages__message {
        font-size: 0.75rem;
      }
    }
  }

  &__hint {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 0.25rem;
    padding-left: 2px;
  }
}
</style>
