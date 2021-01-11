<script>
const ADMIN_USERNAME = process.env.ADMIN_USERNAME
import * as acls from '~/helpers/pages-acls.js'

export default {
  name: `bs-page-admin-login`,
  layout: `centered`,
  meta: { acl: acls.ACL_NOT_CONNECTED },
  ADMIN_USERNAME,
}
</script>

<template>
  <v-card class="elevation-12">
    <v-toolbar flat>
      <v-toolbar-title>{{$t('forms.user.adminLogin')}}</v-toolbar-title>
    </v-toolbar>
    <v-divider />
    <v-card-text>
      <v-form action="/account/login/admin" method="post" id="login-form">
        <input type="hidden" name="username" :value="$options.ADMIN_USERNAME" />
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
      <v-btn color="primary" form="login-form" type="submit">{{$t('forms.user.login')}}</v-btn>
    </v-card-actions>
  </v-card>
</template>
