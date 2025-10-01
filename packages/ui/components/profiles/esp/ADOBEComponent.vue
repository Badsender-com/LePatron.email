<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import { ADOBE_TARGET_TYPES } from '~/helpers/constants/adobe-target-types';

export default {
  name: 'ADOBEComponent',
  mixins: [validationMixin],
  props: {
    disabled: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
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
      return this.requiredValidationFunc('name');
    },
    adobeImsUrlErrors() {
      return this.requiredValidationFunc('adobeImsUrl');
    },
    adobeBaseUrlErrors() {
      return this.requiredValidationFunc('adobeBaseUrl');
    },
    apiKeyErrors() {
      return this.requiredValidationFunc('apiKey');
    },
    secretKeyErrors() {
      return this.requiredValidationFunc('secretKey');
    },
    targetTypeErrors() {
      return this.requiredValidationFunc('targetType');
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
    requiredValidationFunc(valueKey) {
      const errors = [];
      const dirty = this.$v?.profile[valueKey]?.$dirty;
      dirty &&
        !this.$v.profile[valueKey]?.required &&
        errors.push(this.$t(`global.errors.${valueKey}Required`));
      return errors;
    },
  },
};
</script>

<template>
  <v-card flat tag="form" :loading="isLoading" :disabled="isLoading">
    <v-card-text class="pb-5">
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="name"
            v-model="profile.name"
            :label="$t('global.profileName')"
            name="name"
            required
            :error-messages="nameErrors"
            @input="$v.profile.name.$touch()"
            @blur="$v.profile.name.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            id="adobeImsUrl"
            v-model="profile.adobeImsUrl"
            :label="$t('global.adobeImsUrl')"
            name="adobeImsUrl"
            required
            :error-messages="adobeImsUrlErrors"
            @input="$v.profile.adobeImsUrl.$touch()"
            @blur="$v.profile.adobeImsUrl.$touch()"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="adobeBaseUrl"
            v-model="profile.adobeBaseUrl"
            :label="$t('global.adobeBaseUrl')"
            name="adobeBaseUrl"
            required
            :error-messages="adobeBaseUrlErrors"
            placeholder="https://example.campaign.adobe.com/nl"
            :hint="$t('global.adobeBaseUrlHelper')"
            persistent-hint
            @input="$v.profile.adobeBaseUrl.$touch()"
            @blur="$v.profile.adobeBaseUrl.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            id="apiKey"
            v-model="profile.apiKey"
            :label="$t('global.apiKey')"
            name="apiKey"
            required
            :error-messages="apiKeyErrors"
            @input="$v.profile.apiKey.$touch()"
            @blur="$v.profile.apiKey.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            id="secretKey"
            v-model="profile.secretKey"
            :label="$t('global.secretKey')"
            name="secretKey"
            required
            :error-messages="secretKeyErrors"
            @input="$v.profile.secretKey.$touch()"
            @blur="$v.profile.secretKey.$touch()"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-radio-group
            v-model="profile.targetType"
            :label="$t('global.targetType')"
            :error-messages="targetTypeErrors"
            row
            @change="$v.profile.targetType.$touch()"
            @blur="$v.profile.targetType.$touch()"
          >
            <v-radio
              v-for="(value, key) in adobeTargetTypes"
              :key="key"
              :label="$t(`adobe.targetTypes.${key}`)"
              :value="value"
            />
          </v-radio-group>
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn
        elevation="0"
        :loading="isLoading"
        :disabled="disabled"
        color="accent"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
