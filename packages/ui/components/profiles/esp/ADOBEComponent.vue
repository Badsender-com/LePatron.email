<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import { ADOBE_TARGET_TYPES } from '~/helpers/constants/adobe-target-types';
import BsTextField from '~/components/form/bs-text-field.vue';
import { Settings, Target } from 'lucide-vue';

export default {
  name: 'ADOBEComponent',
  components: {
    BsTextField,
    LucideSettings: Settings,
    LucideTarget: Target,
  },
  mixins: [validationMixin],
  props: {
    disabled: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
    isEdit: { type: Boolean, default: false },
    profileData: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      profile: {
        id: this.profileData.id ?? '',
        name: this.profileData.name ?? '',
        adobeImsUrl:
          this.profileData.adobeImsUrl ??
          process.env.NUXT_ENV_ADOBE_DEFAULT_IMS_URL,
        adobeBaseUrl: this.profileData.adobeBaseUrl ?? '',
        apiKey: this.profileData.apiKey ?? '',
        secretKey: this.profileData.secretKey ?? '',
        targetType:
          this.profileData.targetType ?? ADOBE_TARGET_TYPES.NMS_DELIVERY_MODEL,
        contentSendType: CONTENT_ESP_TYPES.MAIL,
        type: ESP_TYPES.ADOBE,
      },
      adobeTargetTypes: ADOBE_TARGET_TYPES,
    };
  },
  validations() {
    return {
      profile: {
        name: { required },
        adobeImsUrl: { required },
        adobeBaseUrl: { required },
        apiKey: { required },
        secretKey: { required },
        targetType: { required },
      },
    };
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.profile.name.$dirty) return errors;
      if (!this.$v.profile.name.required) {
        errors.push(this.$t('global.errors.nameRequired'));
      }
      return errors;
    },
    adobeImsUrlErrors() {
      const errors = [];
      if (!this.$v.profile.adobeImsUrl.$dirty) return errors;
      if (!this.$v.profile.adobeImsUrl.required) {
        errors.push(this.$t('global.errors.adobeImsUrlRequired'));
      }
      return errors;
    },
    adobeBaseUrlErrors() {
      const errors = [];
      if (!this.$v.profile.adobeBaseUrl.$dirty) return errors;
      if (!this.$v.profile.adobeBaseUrl.required) {
        errors.push(this.$t('global.errors.adobeBaseUrlRequired'));
      }
      return errors;
    },
    apiKeyErrors() {
      const errors = [];
      if (!this.$v.profile.apiKey.$dirty) return errors;
      if (!this.$v.profile.apiKey.required) {
        errors.push(this.$t('global.errors.apiKeyRequired'));
      }
      return errors;
    },
    secretKeyErrors() {
      const errors = [];
      if (!this.$v.profile.secretKey.$dirty) return errors;
      if (!this.$v.profile.secretKey.required) {
        errors.push(this.$t('global.errors.secretKeyRequired'));
      }
      return errors;
    },
    submitLabel() {
      return this.isEdit ? this.$t('global.save') : this.$t('global.create');
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.profile);
    },
    onCancel() {
      this.$emit('cancel');
    },
  },
};
</script>

<template>
  <div class="esp-form">
    <!-- API Configuration Section -->
    <div class="form-section">
      <div class="form-section__header">
        <lucide-settings :size="20" class="form-section__icon" />
        <div>
          <h3 class="form-section__title">
            {{ $t('profiles.apiConfiguration') }}
          </h3>
          <p class="form-section__description">
            {{ $t('profiles.apiConfigurationDescription') }}
          </p>
        </div>
      </div>
      <div class="form-section__content">
        <v-row>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.name"
              :label="$t('global.profileName')"
              :error-messages="nameErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.name.$touch()"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <bs-text-field
              v-model="profile.adobeImsUrl"
              :label="$t('global.adobeImsUrl')"
              :error-messages="adobeImsUrlErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.adobeImsUrl.$touch()"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <bs-text-field
              v-model="profile.adobeBaseUrl"
              :label="$t('global.adobeBaseUrl')"
              :error-messages="adobeBaseUrlErrors"
              :disabled="isLoading"
              placeholder="https://example.campaign.adobe.com/nl"
              :hint="$t('global.adobeBaseUrlHelper')"
              persistent-hint
              required
              @blur="$v.profile.adobeBaseUrl.$touch()"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.apiKey"
              :label="$t('global.apiKey')"
              :error-messages="apiKeyErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.apiKey.$touch()"
            />
          </v-col>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.secretKey"
              :label="$t('global.secretKey')"
              :error-messages="secretKeyErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.secretKey.$touch()"
            />
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- Target Type Section -->
    <div class="form-section">
      <div class="form-section__header">
        <lucide-target :size="20" class="form-section__icon" />
        <div>
          <h3 class="form-section__title">
            {{ $t('global.targetType') }}
          </h3>
          <p class="form-section__description">
            {{ $t('profiles.targetTypeDescription') }}
          </p>
        </div>
      </div>
      <div class="form-section__content">
        <v-radio-group
          v-model="profile.targetType"
          :disabled="isLoading"
          class="target-type-radio"
        >
          <v-radio
            v-for="(value, key) in adobeTargetTypes"
            :key="key"
            :label="$t(`adobe.targetTypes.${key}`)"
            :value="value"
            color="accent"
          />
        </v-radio-group>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <v-btn text color="primary" :disabled="isLoading" @click="onCancel">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        color="accent"
        elevation="0"
        :loading="isLoading"
        :disabled="disabled"
        @click="onSubmit"
      >
        {{ submitLabel }}
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.esp-form {
  margin-top: 1rem;
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  &:last-of-type {
    border-bottom: none;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  &__icon {
    color: var(--v-accent-base);
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    margin: 0 0 0.25rem 0;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  &__content {
    padding-left: 2rem;
  }
}

.target-type-radio {
  margin-top: 0;
  padding-top: 0;

  ::v-deep .v-input--selection-controls__input {
    margin-right: 8px;
  }

  ::v-deep .v-label {
    font-size: 0.875rem;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
