<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
export default {
  name: 'DSCComponent',
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
        apiKey: this.profileData.apiKey ?? '',
        contentSendType: CONTENT_ESP_TYPES.MAIL,
        typeCampagne: this.profileData.typeCampagne ?? '',
        type: ESP_TYPES.DSC,
      },
    };
  },
  validations() {
    return {
      profile: {
        name: {
          required,
        },
        apiKey: {
          required,
        },
        typeCampagne: {
          required,
        },
      },
    };
  },
  computed: {
    nameErrors() {
      return this.requiredValidationFunc('name');
    },
    apiKeyErrors() {
      return this.requiredValidationFunc('apiKey');
    },
    typeCampagneErrors() {
      return this.requiredValidationFunc('typeCampagne');
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
    emailValidationFunc(valueKey) {
      const errors = [];
      const dirty = this.$v?.profile[valueKey]?.$dirty;
      dirty &&
        !this.$v.profile[valueKey].required &&
        errors.push(this.$t(`global.errors.${valueKey}Required`));
      dirty &&
        !this.$v.profile[valueKey].email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
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
            id="typeCampagne"
            v-model="profile.typeCampagne"
            :label="$t('global.typeCampagne')"
            name="typeCampagne"
            :error-messages="typeCampagneErrors"
            @input="$v.profile.typeCampagne.$touch()"
            @blur="$v.profile.typeCampagne.$touch()"
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
