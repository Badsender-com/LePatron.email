<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import { Settings } from 'lucide-vue';

export default {
  name: 'DSCComponent',
  components: {
    BsTextField,
    BsFormSection,
    LucideSettings: Settings,
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
        name: { required },
        apiKey: { required },
        typeCampagne: { required },
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
    typeCampagneErrors() {
      const errors = [];
      if (!this.$v.profile.typeCampagne.$dirty) return errors;
      if (!this.$v.profile.typeCampagne.required) {
        errors.push(this.$t('global.errors.typeCampagneRequired'));
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
      <bs-form-section last>
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
            <bs-text-field
              v-model="profile.typeCampagne"
              :label="$t('global.typeCampagne')"
              :error-messages="typeCampagneErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.typeCampagne.$touch()"
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
