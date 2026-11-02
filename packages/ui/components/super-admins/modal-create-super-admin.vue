<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';

const emptyUser = () => ({ email: '', name: '', lang: 'fr' });

export default {
  name: 'BsModalCreateSuperAdmin',
  components: { BsModalForm, BsTextField, BsSelect },
  mixins: [validationMixin],
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return { user: emptyUser() };
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
    open() {
      this.user = emptyUser();
      this.$v.$reset();
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', { ...this.user });
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="$t('superAdmins.add')"
    :submit-label="$t('global.create')"
    :loading="loading"
    width="600"
    @submit="onSubmit"
  >
    <p class="text-caption text--secondary">
      {{ $t('superAdmins.addDescription') }}
    </p>
    <v-row>
      <v-col cols="12" md="6">
        <bs-text-field
          v-model="user.email"
          :label="$t('users.email')"
          type="email"
          required
          :error-messages="emailErrors"
          :disabled="loading"
          autofocus
          @input="$v.user.email.$touch()"
          @blur="$v.user.email.$touch()"
        />
      </v-col>
      <v-col cols="12" md="6">
        <bs-text-field
          v-model="user.name"
          :label="$t('forms.user.name')"
          required
          :error-messages="nameErrors"
          :disabled="loading"
          @input="$v.user.name.$touch()"
          @blur="$v.user.name.$touch()"
        />
      </v-col>
      <v-col cols="12" md="6">
        <bs-select
          v-model="user.lang"
          :label="$t('users.lang')"
          :items="$options.supportedLanguages"
          :disabled="loading"
        />
      </v-col>
    </v-row>
  </bs-modal-form>
</template>
