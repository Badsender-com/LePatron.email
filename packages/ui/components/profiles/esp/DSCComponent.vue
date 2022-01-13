<script>
import { validationMixin } from 'vuelidate';
import { email, required } from 'vuelidate/lib/validators';
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
        senderName: this.profileData.senderName ?? '',
        senderMail: this.profileData.senderMail ?? '',
        contentSendType: CONTENT_ESP_TYPES.MAIL,
        replyTo: this.profileData.replyTo ?? '',
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
        senderName: {
          required,
        },
        senderMail: {
          required,
          email,
        },
        replyTo: {
          required,
          email,
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
    senderNameErrors() {
      return this.requiredValidationFunc('senderName');
    },
    senderMailErrors() {
      return this.emailValidationFunc('senderMail');
    },
    replyToErrors() {
      return this.emailValidationFunc('replyTo');
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
  <v-card tag="form" :loading="isLoading" :disabled="isLoading">
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
            id="senderName"
            v-model="profile.senderName"
            :label="$t('profiles.senderName')"
            name="senderName"
            required
            :error-messages="senderNameErrors"
            @input="$v.profile.senderName.$touch()"
            @blur="$v.profile.senderName.$touch()"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="senderMail"
            v-model="profile.senderMail"
            :label="$t('profiles.senderMail')"
            name="senderMail"
            required
            :error-messages="senderMailErrors"
            @input="$v.profile.senderMail.$touch()"
            @blur="$v.profile.senderMail.$touch()"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="replyTo"
            v-model="profile.replyTo"
            :label="$t('profiles.replyTo')"
            name="replyTo"
            required
            :error-messages="replyToErrors"
            @input="$v.profile.replyTo.$touch()"
            @blur="$v.profile.replyTo.$touch()"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn
        text
        large
        :loading="isLoading"
        :disabled="disabled"
        color="primary"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
