<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import BsModalConfirm from '~/components/modal-confirm';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';

export default {
  name: 'BsModalCreateUser',
  components: {
    BsModalConfirm,
    BsTextField,
    BsSelect,
  },
  mixins: [validationMixin],
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  roles: [
    { text: 'Group admin', value: 'company_admin' },
    { text: 'Regular user', value: 'regular_user' },
  ],
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      user: {
        email: '',
        name: '',
        externalUsername: '',
        lang: 'fr',
        role: 'regular_user',
      },
    };
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
      this.user = {
        email: '',
        name: '',
        externalUsername: '',
        lang: 'fr',
        role: 'regular_user',
      };
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
  <bs-modal-confirm
    ref="modal"
    :title="$t('global.newUser')"
    :is-form="true"
    modal-width="600"
  >
    <v-form @submit.prevent="onSubmit">
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
          <bs-text-field
            v-model="user.externalUsername"
            :label="$t('forms.user.externalUsername') + $t('forms.user.optional')"
            :disabled="loading"
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
        <v-col cols="12" md="6">
          <bs-select
            v-model="user.role"
            :label="$t('users.role')"
            :items="$options.roles"
            :disabled="loading"
          />
        </v-col>
      </v-row>
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-spacer />
        <v-btn text color="primary" :disabled="loading" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="accent"
          elevation="0"
          :loading="loading"
          :disabled="loading"
        >
          {{ $t('global.create') }}
        </v-btn>
      </div>
    </v-form>
  </bs-modal-confirm>
</template>

<style scoped>
.modal-actions {
  display: flex;
  align-items: center;
  padding: 1rem 0;
}
</style>
