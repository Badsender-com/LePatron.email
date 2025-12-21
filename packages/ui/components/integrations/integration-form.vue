<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

export default {
  name: 'BsIntegrationForm',
  mixins: [validationMixin],
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
    providerOptions() {
      return this.providers.map((p) => ({
        value: p,
        text: this.getProviderLabel(p),
      }));
    },
    selectedProviderConfig() {
      const configs = {
        openai: {
          apiKeyPlaceholder: 'sk-...',
          apiHostPlaceholder: 'https://api.openai.com',
          apiHostHint: this.$t('integrations.openai.apiHostHint'),
          showProductId: false,
        },
        mistral: {
          apiKeyPlaceholder: 'your-mistral-api-key',
          apiHostPlaceholder: 'https://api.mistral.ai',
          apiHostHint: this.$t('integrations.mistral.apiHostHint'),
          showProductId: false,
        },
        infomaniak: {
          apiKeyPlaceholder: 'your-infomaniak-api-key',
          apiHostPlaceholder: '',
          apiHostHint: '',
          showProductId: true,
          productIdHint: this.$t('integrations.infomaniak.productIdHint'),
        },
      };
      return configs[this.form.provider] || {};
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
    // Product ID required for Infomaniak
    if (this.form.provider === 'infomaniak') {
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

    getProviderLabel(provider) {
      const labels = {
        openai: 'OpenAI',
        mistral: 'Mistral AI',
        infomaniak: 'Infomaniak AI Tools',
      };
      return labels[provider] || provider;
    },

    productIdErrors() {
      const errors = [];
      if (!this.$v.form.productId || !this.$v.form.productId.$dirty)
        return errors;
      !this.$v.form.productId.required &&
        errors.push(this.$t('global.errors.required'));
      return errors;
    },

    nameErrors() {
      const errors = [];
      if (!this.$v.form.name.$dirty) return errors;
      !this.$v.form.name.required &&
        errors.push(this.$t('global.errors.required'));
      return errors;
    },

    providerErrors() {
      const errors = [];
      if (!this.$v.form.provider.$dirty) return errors;
      !this.$v.form.provider.required &&
        errors.push(this.$t('global.errors.required'));
      return errors;
    },

    apiKeyErrors() {
      const errors = [];
      if (!this.$v.form.apiKey || !this.$v.form.apiKey.$dirty) return errors;
      !this.$v.form.apiKey.required &&
        errors.push(this.$t('global.errors.required'));
      return errors;
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
        <v-text-field
          v-model="form.name"
          :label="$t('integrations.name')"
          :error-messages="nameErrors()"
          :disabled="loading"
          outlined
          dense
          @blur="$v.form.name.$touch()"
        />

        <v-select
          v-model="form.provider"
          :items="providerOptions"
          :label="$t('integrations.provider')"
          :error-messages="providerErrors()"
          :disabled="loading || isEdit"
          outlined
          dense
          @blur="$v.form.provider.$touch()"
        />

        <v-text-field
          v-model="form.apiKey"
          :label="$t('integrations.apiKey')"
          :placeholder="selectedProviderConfig.apiKeyPlaceholder"
          :error-messages="apiKeyErrors()"
          :disabled="loading"
          :type="showApiKey ? 'text' : 'password'"
          :hint="isEdit ? $t('integrations.apiKeyHintEdit') : ''"
          persistent-hint
          outlined
          dense
          @blur="$v.form.apiKey && $v.form.apiKey.$touch()"
        >
          <template #append>
            <v-icon @click="showApiKey = !showApiKey">
              {{ showApiKey ? 'mdi-eye-off' : 'mdi-eye' }}
            </v-icon>
          </template>
        </v-text-field>

        <v-text-field
          v-if="showProductIdField"
          v-model="form.productId"
          :label="$t('integrations.productId')"
          :error-messages="productIdErrors()"
          :hint="selectedProviderConfig.productIdHint"
          :disabled="loading"
          persistent-hint
          outlined
          dense
          @blur="$v.form.productId && $v.form.productId.$touch()"
        />

        <v-text-field
          v-if="selectedProviderConfig.apiHostPlaceholder"
          v-model="form.apiHost"
          :label="$t('integrations.apiHost')"
          :placeholder="selectedProviderConfig.apiHostPlaceholder"
          :hint="selectedProviderConfig.apiHostHint"
          :disabled="loading"
          persistent-hint
          outlined
          dense
        />

        <v-switch
          v-model="form.isActive"
          :label="$t('integrations.active')"
          :disabled="loading"
          color="primary"
        />
      </v-form>
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn text :disabled="loading" @click="onCancel">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn color="primary" :loading="loading" @click="onSubmit">
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
