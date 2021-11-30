<script>
import { validationMixin } from 'vuelidate';
import { required, sameAs } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'BsPageSetPassword',
  mixins: [validationMixin],
  meta: { acl: acls.ACL_NOT_CONNECTED },
  layout: 'centered',
  data() {
    return {
      loading: false,
      form: {
        password: '',
        passwordConfirm: '',
      },
    };
  },
  head() {
    return { title: this.title };
  },
  validations() {
    return {
      form: {
        password: { required },
        passwordConfirm: { required, sameAsPassword: sameAs('password') },
      },
    };
  },
  computed: {
    title() {
      return 'set password';
    },
    passwordErrors() {
      const errors = [];
      if (!this.$v.form.password.$dirty) return errors;
      !this.$v.form.password.required &&
        errors.push(this.$t('forms.user.errors.password.required'));
      return errors;
    },
    passwordConfirmErrors() {
      const errors = [];
      if (!this.$v.form.passwordConfirm.$dirty) return errors;
      !this.$v.form.passwordConfirm.required &&
        errors.push(this.$t('forms.user.errors.password.confirm'));
      !this.$v.form.passwordConfirm.sameAsPassword &&
        errors.push(this.$t('forms.user.errors.password.same'));
      return errors;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async setPassword() {
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const { $axios, $route, $router } = this;
      this.loading = true;
      try {
        await $axios.$put(
          apiRoutes.accountSetPassword($route.params),
          this.form
        );
        $router.push('/');
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <v-card class="elevation-12">
    <v-toolbar flat>
      <v-toolbar-title>{{ $t('forms.user.passwordReset') }}</v-toolbar-title>
    </v-toolbar>
    <v-divider />
    <v-card-text>
      <v-form id="login-form" method="post" @submit.prevent="setPassword">
        <v-text-field
          id="password"
          v-model="form.password"
          :label="$t('global.password')"
          name="password"
          prepend-icon="lock"
          :error-messages="passwordErrors"
          type="password"
          required
          :disabled="loading"
        />
        <v-text-field
          id="passwordConfirm"
          v-model="form.passwordConfirm"
          :label="$t('forms.user.passwordConfirm')"
          name="passwordConfirm"
          :error-messages="passwordConfirmErrors"
          prepend-icon="lock"
          type="password"
          required
          :disabled="loading"
        />
      </v-form>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        color="accent"
        elevation="0"
        form="login-form"
        type="submit"
        :disabled="loading"
      >
        {{ $t('forms.user.validate') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
