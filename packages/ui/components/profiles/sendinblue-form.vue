<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

export default {
  name: 'SendinblueForm',
  mixins: [validationMixin],
  model: { prop: 'profile', event: 'update' },
  props: {
    profile: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
  },
  validations() {
    return {
      profile: {
        name: { required },
      },
    };
  },
  computed: {
    localModel: {
      get() {
        return this.profile;
      },
      set(updatedProfile) {
        this.$emit('update', updatedProfile);
      },
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.profile.name.$dirty) return errors;
      !this.$v.profile.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', this.profile);
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <v-card-title>{{ $t('global.newTemplate') }}</v-card-title>
    <v-card-text>
      <v-text-field
        id="name"
        v-model="localModel.name"
        :label="$t('global.name')"
        name="name"
        :error-messages="nameErrors"
        :disabled="disabled"
        @input="$v.profile.name.$touch()"
        @blur="$v.profile.name.$touch()"
      />
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn text large color="primary" :disabled="disabled" @click="onSubmit">
        {{ $t('global.create') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
