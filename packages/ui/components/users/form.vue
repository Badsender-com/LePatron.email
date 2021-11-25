<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';

export default {
  name: 'BsUserForm',
  mixins: [validationMixin],
  model: { prop: 'user', event: 'update' },
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  roles: [
    { text: 'Group admin', value: 'company_admin' },
    { text: 'Regular user', value: 'regular_user' },
  ],
  props: {
    user: { type: Object, default: () => ({}) },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    title: { type: String, default: '' },
  },
  validations() {
    return {
      user: {
        email: { required, email },
        name: { required },
        role: { required },
      },
    };
  },
  computed: {
    localModel: {
      get() {
        return this.user;
      },
      set(updatedUser) {
        this.$emit('update', updatedUser);
      },
    },
    emailErrors() {
      const errors = [];
      if (!this.$v.user.email.$dirty) return errors;
      !this.$v.user.email.required &&
        errors.push(this.$t('forms.user.errors.email.required'));
      !this.$v.user.email.email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
      return errors;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.user.name.$dirty) return errors;
      !this.$v.user.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', this.user);
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <v-card-title v-if="title">
      {{ title }}
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="6">
          <v-text-field
            id="email"
            v-model="localModel.email"
            :label="$t('users.email')"
            name="email"
            type="email"
            required
            :error-messages="emailErrors"
            @input="$v.user.email.$touch()"
            @blur="$v.user.email.$touch()"
          />
        </v-col>
        <v-col cols="6">
          <v-text-field
            id="name"
            v-model="localModel.name"
            :label="$t('global.name')"
            name="name"
            :error-messages="nameErrors"
            @input="$v.user.name.$touch()"
            @blur="$v.user.name.$touch()"
          />
        </v-col>
        <v-col cols="6">
          <v-select
            id="lang"
            v-model="localModel.lang"
            :label="$t('users.lang')"
            name="lang"
            :items="$options.supportedLanguages"
          />
        </v-col>
        <v-col cols="6">
          <v-select
            id="lang"
            v-model="localModel.role"
            :label="$t('users.role')"
            name="role"
            :items="$options.roles"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn color="primary" :disabled="disabled" @click="onSubmit">
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
