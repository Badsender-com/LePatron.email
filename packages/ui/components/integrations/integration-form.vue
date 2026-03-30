<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { getProviderFormConfig, getProviderLabel } from './provider-configs';

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
        <v-text-field
          v-model="form.name"
          :label="$t('integrations.name')"
          :error-messages="fieldErrors('name')"
          :disabled="loading"
          outlined
          dense
          @blur="$v.form.name.$touch()"
        />

        <v-select
          v-model="form.provider"
          :items="providerOptions"
          :label="$t('integrations.provider')"
          :error-messages="fieldErrors('provider')"
          :disabled="loading || isEdit"
          outlined
          dense
          @blur="$v.form.provider.$touch()"
        />

        <v-text-field
          v-model="form.apiKey"
          :label="apiKeyLabel"
          :placeholder="
            selectedProviderConfig.apiKeyPlaceholderKey
              ? $t(selectedProviderConfig.apiKeyPlaceholderKey)
              : ''
          "
          :error-messages="fieldErrors('apiKey')"
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
          :error-messages="fieldErrors('productId')"
          :hint="
            selectedProviderConfig.productIdHintKey
              ? $t(selectedProviderConfig.productIdHintKey)
              : ''
          "
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
          :hint="
            selectedProviderConfig.apiHostHintKey
              ? $t(selectedProviderConfig.apiHostHintKey)
              : ''
          "
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
