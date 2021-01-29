<script>
import { required } from 'vuelidate/lib/validators';
import * as apiRoutes from '~/helpers/api-routes.js';
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import { USER, M_USER_SET } from '~/store/user';

export default {
  name: `bs-page-login`,
  meta: { acl: acls.ACL_NOT_CONNECTED },
  layout: `centered`,
  head() {
    return { title: this.title };
  },
  created() {
    if (this.$route.query.error) {
      const errorMessage = this.$t(`global.errors.${this.$route.query.error}`);
      this.$router.replace('/account/login');
      this.showSnackbar({
        text: errorMessage,
        color: `error`,
      });
    }
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
  },
  computed: {
    title() {
      return `login`;
    },
  },
  data() {
      return {
          username: "",
          password: "",
          submitted: false,
          userIsFound: false,
          isBasicAuthentication : true,
          isLoading : false
      };
  },
  validations: {
    username: { required },
  },
  methods:{
    checkEmailForm: async function() {
        this.submitted = true;
        this.$v.$touch();
        if (this.$v.$invalid) {
            return;
        }

        // move to service
        try {
          this.isLoading = true;
          const profile = await this.$axios.$get(apiRoutes.getPublicProfile({username : this.username}));
          this.isLoading = false;
          if (profile && profile.group && profile.group.isSAMLAuthentication) {
            window.location = `/account/SAML-login?email=${this.username}`;
          } else {
            this.isBasicAuthentication = true;
            this.userIsFound = true;
          }
          console.log({profile})
        } catch (error) {
          console.error(error);
          this.isLoading = false;
        }
    },
    handleSubmit: async function() {
      try {
        // move to service
        const { $axios, $router, username, password} = this;
        this.isLoading = true;
        await $axios.$post('/account/login', {username, password});
        // TODO
        this.$store.commit(`${USER}/${M_USER_SET}`);
        $router.push('/');
      } catch (error) {
        console.error(error);
        this.isLoading = false;
      }

    }
  }
};
</script>

<template>
  <v-card class="elevation-12">
    <v-toolbar flat>
      <v-toolbar-title>{{ $t('forms.user.login') }}</v-toolbar-title>
    </v-toolbar>
    <v-divider />
    <div v-if="!userIsFound">
      <v-card-text>
        <v-form @submit.prevent="checkEmailForm" id="check-email-form">
          <v-text-field
            v-model="username"
            autofocus
            :label="$t('users.email')"
            name="username"
            prepend-icon="email"
            type="text"
            required
          />
        </v-form>
      </v-card-text>

      <v-card-actions >
        <v-spacer />
        <v-btn :loading="isLoading" color="primary" form="check-email-form" type="submit">
            {{$t('forms.user.login')}}
          </v-btn>
      </v-card-actions>
    </div>

    <!-- Password field  -->
    <div v-if="userIsFound && isBasicAuthentication" >
      <v-card-text >
        <v-form @submit.prevent="handleSubmit" id="login-form" >
          <v-text-field
            v-model="password"
            autofocus
            id="password"
            :label="$t('global.password')"
            name="password"
            prepend-icon="lock"
            type="password"
            required
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn nuxt text color="primary" to="/account/reset-password">{{
          $t('forms.user.forgottenPassword')
        }}</v-btn>
        <v-btn :loading="isLoading" color="primary" form="login-form" type="submit">{{
          $t('forms.user.login')
        }}</v-btn>
      </v-card-actions>
     </div>
  </v-card>
</template>
