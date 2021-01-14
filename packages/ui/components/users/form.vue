<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength, email } from 'vuelidate/lib/validators';

export default {
  name: `bs-user-form`,
  mixins: [validationMixin],
  model: { prop: `user`, event: `update` },
  supportedLanguages: [
    { text: `English`, value: `en` },
    { text: `Français`, value: `fr` },
  ],
  props: {
    user: { type: Object, default: () => ({}) },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    title: { type: String, default: `` },
  },
  validations() {
    return {
      user: {
        email: { required, email },
        name: { required },
      },
    };
  },
  computed: {
    localModel: {
      get() {
        return this.user;
      },
      set(updatedUser) {
        this.$emit(`update`, updatedUser);
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
      this.$emit(`submit`, this.user);
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <v-card-title v-if="title">{{ title }}</v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="6">
          <v-text-field
            v-model="user.email"
            id="email"
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
            v-model="user.name"
            id="name"
            :label="$t('global.name')"
            name="name"
            :error-messages="nameErrors"
            @input="$v.user.name.$touch()"
            @blur="$v.user.name.$touch()"
          />
        </v-col>
        <v-col cols="6">
          <v-select
            v-model="user.lang"
            id="lang"
            :label="$t('users.lang')"
            name="lang"
            :items="$options.supportedLanguages"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn
        text
        large
        color="primary"
        @click="onSubmit"
        :disabled="disabled"
        >{{ $t('global.save') }}</v-btn
      >
    </v-card-actions>
  </v-card>
</template>
