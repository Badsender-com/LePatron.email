<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';

import * as acls from '~/helpers/pages-acls.js';

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
          isBasicAuthentication : true
      };
  },
  // validations: {
  //   username: { required },
  // },
  methods:{
    checkEmailForm: function() {
        this.submitted = true;
          console.log(this)
           console.log(this.username)
        // this.$v.$touch();
        // if (this.$v.$invalid) {
        //     return;
        // }
        // TODO make API call
        // mock result


        this.userIsFound = true;
        if (true) {
          window.location = `/account/SAML-login?email=${this.username}`;
        } else {

          this.isBasicAuthentication = true;
        }
    }, 
    handleSubmit: function() {
      console.log("Submit")
      console.log(this.username)
      console.log(this.password)
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
    <v-div v-if="!userIsFound"> 
      <v-card-text>
        <v-form @submit.prevent="checkEmailForm" id="check-email-form">
          <v-text-field
            v-model="username"
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
        <v-btn color="primary" form="check-email-form" type="submit">
            {{$t('forms.user.login')}}
          </v-btn>
      </v-card-actions>
    </v-div>

    <!-- Password field  -->
    <v-div v-if="userIsFound && isBasicAuthentication" > 
      <v-card-text >
        <v-form @submit.prevent="handleSubmit" id="login-form" >
          <v-text-field
            v-model="password"
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
        <v-btn color="primary" form="login-form" type="submit">{{
          $t('forms.user.login')
        }}</v-btn>
      </v-card-actions>
     </v-div> 
  </v-card>
</template>
