<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';

export default {
  name: 'FormEmailGroup',
  mixins: [validationMixin],
  model: { prop: 'emailsGroup', event: 'update' },
  props: {
    emailsGroup: { type: Object, default: () => ({}) },
    title: { type: String, default: '' },
    loading: { type: Boolean, default: false },
  },
  validations: () => ({
    emailsGroup: {
      name: { required },
      emails: {
        required,
        emailsValid: (val) =>
          val
            ?.split(';')
            ?.map((element) => email(element))
            ?.every((emailValid) => emailValid === true),
      },
    },
  }),
  computed: {
    localModel: {
      get() {
        return this.emailsGroup;
      },
      set(updatedEmailsGroup) {
        this.$emit('update', updatedEmailsGroup);
      },
    },
    emailsErrors() {
      const errors = [];
      if (!this.$v.emailsGroup.emails.$dirty) return errors;
      !this.$v.emailsGroup.emails.required &&
        errors.push(this.$t('forms.emailsGroup.errors.emails.required'));
      !this.$v.emailsGroup.emails.emailsValid &&
        errors.push(this.$t('forms.emailsGroup.errors.emails.emailsValid'));
      return errors;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.emailsGroup.name.$dirty) return errors;
      !this.$v.emailsGroup.name.required &&
        errors.push(this.$t('forms.emailsGroup.errors.name.required'));
      return errors;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', this.emailsGroup);
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
            id="name"
            v-model="localModel.name"
            :label="$t('global.name')"
            name="name"
            :error-messages="nameErrors"
            @input="$v.emailsGroup.name.$touch()"
            @blur="$v.emailsGroup.name.$touch()"
          />
        </v-col>
        <v-col cols="10">
          <v-textarea
            id="emails"
            v-model="localModel.emails"
            :label="$t('forms.emailsGroup.emails')"
            name="emails"
            :placeholder="$t('forms.emailsGroup.emailsPlaceholder')"
            :persistent-placeholder="true"
            required
            outlined
            :error-messages="emailsErrors"
            @input="$v.emailsGroup.emails.$touch()"
            @blur="$v.emailsGroup.emails.$touch()"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn flat color="primary" :disabled="loading" @click="onSubmit">
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
