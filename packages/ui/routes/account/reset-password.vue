<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { KeyRound, MailCheck, Send } from 'lucide-vue';
import BsAuthCard from '~/components/account/auth-card.vue';
import BsTextField from '~/components/form/bs-text-field.vue';

export default {
  name: 'BsPageResetPassword',
  components: {
    BsAuthCard,
    BsTextField,
    LucideKeyRound: KeyRound,
    LucideMailCheck: MailCheck,
    LucideSend: Send,
  },
  mixins: [validationMixin],
  meta: { acl: acls.ACL_NOT_CONNECTED },
  layout: 'centered',
  data() {
    return {
      loading: false,
      form: { email: '' },
      // Once the link left: where, said in the card rather than a snackbar.
      sentTo: '',
    };
  },
  head() {
    return { title: this.title };
  },
  validations() {
    return {
      form: {
        email: { required, email },
      },
    };
  },
  computed: {
    title() {
      return 'reset password';
    },
    emailErrors() {
      const errors = [];
      if (!this.$v.form.email.$dirty) return errors;
      !this.$v.form.email.required &&
        errors.push(this.$t('forms.user.errors.email.required'));
      !this.$v.form.email.email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
      return errors;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async resetPassword() {
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const { $axios } = this;
      this.loading = true;
      try {
        const route = apiRoutes.accountResetPassword({
          email: this.form.email,
        });
        await $axios.$delete(route);
        this.sentTo = this.form.email;
      } catch (error) {
        this.showSnackbar({
          text:
            error.response?.status === 429
              ? this.$t('global.errors.tooManyRequests')
              : this.$t('global.errors.errorOccured'),
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
  <bs-auth-card
    v-if="!sentTo"
    :title="$t('authCard.forgotTitle')"
    :loading="loading"
  >
    <template #icon><lucide-key-round :size="26" /></template>
    <template #description>{{ $t('authCard.forgotIntro') }}</template>
    <form
      id="reset-password-form"
      method="post"
      @submit.prevent="resetPassword"
    >
      <bs-text-field
        id="email"
        v-model="form.email"
        autofocus
        dense
        :label="$t('users.email')"
        name="email"
        type="email"
        autocomplete="username"
        required
        :disabled="loading"
        :error-messages="emailErrors"
        @input="$v.form.email.$touch()"
        @blur="$v.form.email.$touch()"
      />
    </form>
    <template #actions>
      <v-btn text color="primary" nuxt to="/account/login">
        {{ $t('authCard.backToLogin') }}
      </v-btn>
      <v-spacer />
      <v-btn
        color="accent"
        elevation="0"
        form="reset-password-form"
        type="submit"
        :loading="loading"
      >
        <lucide-send :size="16" class="mr-2" />
        {{ $t('authCard.sendLink') }}
      </v-btn>
    </template>
  </bs-auth-card>

  <bs-auth-card v-else :title="$t('authCard.linkSentTitle')" :loading="loading">
    <template #icon><lucide-mail-check :size="26" /></template>
    <template #description>
      <i18n path="authCard.linkSent" tag="span">
        <template #email>
          <strong>{{ sentTo }}</strong>
        </template>
      </i18n>
    </template>
    <template #actions>
      <v-btn text color="primary" :disabled="loading" @click="resetPassword">
        {{ $t('authCard.sendAgain') }}
      </v-btn>
      <v-spacer />
      <v-btn color="accent" elevation="0" nuxt to="/account/login">
        {{ $t('authCard.backToLogin') }}
      </v-btn>
    </template>
  </bs-auth-card>
</template>
