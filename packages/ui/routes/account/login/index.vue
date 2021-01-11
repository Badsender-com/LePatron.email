<script>
import { validationMixin } from 'vuelidate'
import { required, email } from 'vuelidate/lib/validators'

import * as acls from '~/helpers/pages-acls.js'

export default {
  name: `bs-page-login`,
  meta: { acl: acls.ACL_NOT_CONNECTED },
  layout: `centered`,
  head() {
    return { title: this.title }
  },
  computed: {
    title() {
      return `login`
    },
  },
}
</script>

<template>
  <v-card class="elevation-12">
    <v-toolbar flat>
      <v-toolbar-title>{{$t('forms.user.login')}}</v-toolbar-title>
    </v-toolbar>
    <v-divider />
    <v-card-text>
      <v-form action="/account/login" method="post" id="login-form">
        <v-text-field :label="$t('users.email')" name="username" prepend-icon="email" type="text" required />
        <v-text-field
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
      <v-btn nuxt text color="primary" to="/account/reset-password">{{$t('forms.user.forgottenPassword')}}</v-btn>
      <v-btn color="primary" form="login-form" type="submit">{{$t('forms.user.login')}}</v-btn>
    </v-card-actions>
  </v-card>
</template>
