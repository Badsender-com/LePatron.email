<script>
import { validationMixin } from 'vuelidate';
import { email, required } from 'vuelidate/lib/validators';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
export default {
  name: 'SENDINGBLUEComponent',
  mixins: [validationMixin],
  props: {
    disabled: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
    profileData: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      submitStatus: null,
      possibleContentSendType: [
        {
          text: 'Mail',
          value: CONTENT_ESP_TYPES.MAIL,
        },
        {
          text: 'Template',
          value: CONTENT_ESP_TYPES.TEMPLATE,
        },
      ],
      profile: {
        id: this.profileData.id ?? '',
        name: this.profileData.name ?? '',
        apiKey: this.profileData.apiKey ?? '',
        senderName: this.profileData.senderName ?? '',
        senderMail: this.profileData.senderMail ?? '',
        contentSendType:
          this.profileData.contentSendType ?? CONTENT_ESP_TYPES.MAIL,
        replyTo: this.profileData.replyTo ?? '',
        type: ESP_TYPES.SENDINBLUE,
      },
      contentSendTypeSelect: null,
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
        contentSendType: {},
        senderMail: {
          required,
          email,
        },
        replyTo: {},
        type: {},
      },
    };
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.profile.name.$dirty) return errors;
      !this.$v.profile.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
    apiKeyErrors() {
      const errors = [];
      if (!this.$v.profile.apiKey.$dirty) return errors;
      !this.$v.profile.apiKey.required &&
        errors.push(this.$t('global.errors.apiKeyRequired'));
      return errors;
    },
    senderNameErrors() {
      const errors = [];
      if (!this.$v.profile.senderName.$dirty) return errors;
      !this.$v.profile.senderName.required &&
        errors.push(this.$t('global.errors.senderNameRequired'));
      return errors;
    },
    senderMailErrors() {
      const errors = [];
      if (!this.$v.profile.senderMail.$dirty) return errors;
      !this.$v.profile.senderMail.required &&
        errors.push(this.$t('global.errors.senderMailRequired'));
      !this.$v.profile.senderMail.email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
      return errors;
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
  <v-card flat tile tag="form" :loading="isLoading" :disabled="isLoading">
    <v-card-text>
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
          <v-select
            v-model="profile.contentSendType"
            name="contentSendType"
            :items="possibleContentSendType"
            :label="$t('profiles.contentSendType')"
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
            @input="$v.profile.replyTo.$touch()"
            @blur="$v.profile.replyTo.$touch()"
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
