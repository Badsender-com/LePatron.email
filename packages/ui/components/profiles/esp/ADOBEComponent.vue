<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import { ADOBE_TARGET_TYPES } from '~/helpers/constants/adobe-target-types';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import { Settings, Target } from 'lucide-vue';

export default {
  name: 'ADOBEComponent',
  components: {
    BsTextField,
    BsFormSection,
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
  },
};
</script>

<template>
  <v-card flat tile class="esp-form">
    <v-card-text>
      <!-- API Configuration Section -->
      <bs-form-section>
        <template #icon>
          <lucide-settings :size="20" />
        </template>
        <template #title>
          {{ $t('profiles.apiConfiguration') }}
        </template>
        <template #description>
          {{ $t('profiles.apiConfigurationDescription') }}
        </template>
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
      </bs-form-section>

      <!-- Target Type Section -->
      <bs-form-section last>
        <template #icon>
          <lucide-target :size="20" />
        </template>
        <template #title>
          {{ $t('global.targetType') }}
        </template>
        <template #description>
          {{ $t('profiles.targetTypeDescription') }}
        </template>
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
      </bs-form-section>
    </v-card-text>

    <v-divider />

    <v-card-actions>
      <v-spacer />

      <v-btn
        color="accent"
        elevation="0"
        :loading="isLoading"
        :disabled="disabled"
        @click="onSubmit"
      >
        {{ submitLabel }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style lang="scss" scoped>
.esp-form {
  margin-top: 1rem;
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
</style>
