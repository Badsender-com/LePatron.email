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
          isLoading : false,
          showPassword: false,
      };
  },
  validations: {
    username: { required },
  },
  methods:{
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    checkEmailForm: async function() {
        this.submitted = true;
        this.$v.$touch();
        if (this.$v.$invalid) {
            return;
        }

        // move to service
        try {
          this.isLoading = true;
          try {
            const profile = await this.$axios.$get(apiRoutes.getPublicProfile({username : this.username}));
            this.isLoading = false;
            if (profile && profile.group && profile.group.isSAMLAuthentication) {
              window.location = `/account/SAML-login?email=${encodeURIComponent(this.username)}`;
            } else {
              this.isBasicAuthentication = true;
              this.userIsFound = true;
            }
          } catch (err) {
            this.isLoading = false;
            const errorMessage = this.$t(`global.errors.password.error.nouser`);
            this.showSnackbar({
              text: errorMessage,
              color: `error`,
            });
          }
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
        try {
          const user = await $axios.$post('/account/login', {username, password});
          this.$store.commit(`${USER}/${M_USER_SET}`, { isAdmin: user.isAdmin });
          $router.go();
        } catch (err) {
          this.isLoading = false;
          const errorMessage = this.$t(`global.errors.password.error.incorrect`);
          this.showSnackbar({
            text: errorMessage,
            color: `error`,
          });
        }
      } catch (error) {
        console.error(error);
        this.isLoading = false;
      }
    },
    back: function() {
      this.username = ""
      this.password = ""
      this.userIsFound = false
      this.isBasicAuthentication = true
    }
  }
};
</script>

<template>
  <v-card class="elevation-12">
    <v-toolbar flat>
      <v-btn
        icon
        @click="back"
        v-if="userIsFound && isBasicAuthentication"
      >
        <v-icon>{{ 'arrow_back' }}</v-icon>
      </v-btn>
      <v-toolbar-title class="pl-0">{{ $t('forms.user.login') }}</v-toolbar-title>
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
            :type="showPassword ? 'text' : 'password'"
            :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            required
            @click:append="showPassword = !showPassword"
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
