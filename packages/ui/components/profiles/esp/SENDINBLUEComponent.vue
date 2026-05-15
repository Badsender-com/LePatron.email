<script>
import { validationMixin } from 'vuelidate';
import { email, required } from 'vuelidate/lib/validators';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import { Settings, Mail } from 'lucide-vue';

export default {
  name: 'SENDINBLUEComponent',
  components: {
    BsTextField,
    BsSelect,
    BsFormSection,
    LucideSettings: Settings,
    LucideMail: Mail,
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
    };
  },
  validations() {
    return {
      profile: {
        name: { required },
        apiKey: { required },
        senderName: { required },
        contentSendType: {},
        senderMail: { required, email },
        replyTo: {},
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
    apiKeyErrors() {
      const errors = [];
      if (!this.$v.profile.apiKey.$dirty) return errors;
      if (!this.$v.profile.apiKey.required) {
        errors.push(this.$t('global.errors.apiKeyRequired'));
      }
      return errors;
    },
    senderNameErrors() {
      const errors = [];
      if (!this.$v.profile.senderName.$dirty) return errors;
      if (!this.$v.profile.senderName.required) {
        errors.push(this.$t('global.errors.senderNameRequired'));
      }
      return errors;
    },
    senderMailErrors() {
      const errors = [];
      if (!this.$v.profile.senderMail.$dirty) return errors;
      if (!this.$v.profile.senderMail.required) {
        errors.push(this.$t('global.errors.senderMailRequired'));
      }
      if (!this.$v.profile.senderMail.email) {
        errors.push(this.$t('forms.user.errors.email.valid'));
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
          <v-col cols="12" md="6">
            <bs-select
              v-model="profile.contentSendType"
              :items="possibleContentSendType"
              :label="$t('profiles.contentSendType')"
              :disabled="isLoading"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <bs-text-field
              v-model="profile.apiKey"
              :label="$t('global.apiKey')"
              :error-messages="apiKeyErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.apiKey.$touch()"
            />
          </v-col>
        </v-row>
      </bs-form-section>

      <!-- Sender Configuration Section -->
      <bs-form-section last>
        <template #icon>
          <lucide-mail :size="20" />
        </template>
        <template #title>
          {{ $t('profiles.senderConfiguration') }}
        </template>
        <template #description>
          {{ $t('profiles.senderConfigurationDescription') }}
        </template>
        <v-row>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.senderName"
              :label="$t('profiles.senderName')"
              :error-messages="senderNameErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.senderName.$touch()"
            />
          </v-col>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.senderMail"
              :label="$t('profiles.senderMail')"
              :error-messages="senderMailErrors"
              :disabled="isLoading"
              type="email"
              required
              @blur="$v.profile.senderMail.$touch()"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.replyTo"
              :label="$t('profiles.replyTo')"
              :disabled="isLoading"
              type="email"
            />
          </v-col>
        </v-row>
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
</style>
