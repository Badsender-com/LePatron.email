<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

export default {
  name: 'ACTITOComponent',
  mixins: [validationMixin],
  model: { prop: 'profile', event: 'update' },
  props: {
    profile: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
  },
  data() {
    return {
      submitStatus: null,
    };
  },
  validations() {
    return {
      profile: {
        name: {
          required,
        },
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
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.profile);
    },
  },
};
</script>

<template>
  <v-card tag="form" :loading="isLoading" :disabled="isLoading">
    <v-card-text>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="name"
            v-model="localModel.name"
            label="Actito name"
            name="name"
            required
            :error-messages="nameErrors"
            @input="$v.profile.name.$touch()"
            @blur="$v.profile.name.$touch()"
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
        sauvegarde
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
