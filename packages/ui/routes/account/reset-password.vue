<script>
import { validationMixin } from 'vuelidate'
import { required, email } from 'vuelidate/lib/validators'
import { mapMutations } from 'vuex'

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js'
import * as acls from '~/helpers/pages-acls.js'
import * as apiRoutes from '~/helpers/api-routes.js'

export default {
  name: `bs-page-reset-password`,
  mixins: [validationMixin],
  meta: { acl: acls.ACL_NOT_CONNECTED },
  layout: `centered`,
  head() {
    return { title: this.title }
  },
  validations() {
    return {
      form: {
        email: { required, email },
      },
    }
  },
  data() {
    return {
      loading: false,
      form: { email: `` },
    }
  },
  computed: {
    title() {
      return `reset password`
    },
    emailErrors() {
      const errors = []
      if (!this.$v.form.email.$dirty) return errors
      !this.$v.form.email.required && errors.push(this.$t('forms.user.errors.email.required'))
      !this.$v.form.email.email && errors.push(this.$t('forms.user.errors.email.valid'))
      return errors
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async resetPassword() {
      this.$v.$touch()
      if (this.$v.$invalid) return

      const { $axios } = this
      this.loading = true
      const formBody = { ...this.form }
      try {
        const route = apiRoutes.accountResetPassword({
          email: this.form.email,
        })
        await $axios.$delete(route)
        this.showSnackbar({ text: this.$t('snackbars.emailSent'), color: `success` })
      } catch (error) {
        this.showSnackbar({ text: this.$t('global.errors.errorOccured'), color: `error` })
        console.log(error)
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<template>
  <v-card class="elevation-12">
    <v-toolbar flat>
      <v-toolbar-title>{{$t('forms.user.passwordReset')}}</v-toolbar-title>
    </v-toolbar>
    <v-divider />
    <v-card-text>
      <form method="post" id="reset-password-form" @submit.prevent="resetPassword">
        <v-text-field
          id="email"
          :label="$t('users.email')"
          name="email"
          v-model="form.email"
          prepend-icon="email"
          type="email"
          :disabled="loading"
          :error-messages="emailErrors"
          @input="$v.form.email.$touch()"
          @blur="$v.form.email.$touch()"
        />
      </form>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        color="primary"
        form="reset-password-form"
        type="submit"
        :disabled="loading"
      >{{$t('forms.user.sendLink')}}</v-btn>
    </v-card-actions>
  </v-card>
</template>
