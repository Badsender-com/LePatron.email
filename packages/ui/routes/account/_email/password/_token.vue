<script>
import { validationMixin } from 'vuelidate';
import { required, sameAs } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { Check, Eye, EyeOff, Link2Off, Lock } from 'lucide-vue';
import BsAuthCard from '~/components/account/auth-card.vue';
import BsTextField from '~/components/form/bs-text-field.vue';

export default {
  name: 'BsPageSetPassword',
  components: {
    BsAuthCard,
    BsTextField,
    LucideCheck: Check,
    LucideEye: Eye,
    LucideEyeOff: EyeOff,
    LucideLink2Off: Link2Off,
    LucideLock: Lock,
  },
  mixins: [validationMixin],
  meta: { acl: acls.ACL_NOT_CONNECTED },
  layout: 'centered',
  data() {
    return {
      loading: false,
      showPassword: false,
      // An unknown, expired or used link: the card says so and offers a
      // new one, the form being of no use.
      linkExpired: false,
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
    // Whose password: the address the link carries.
    email() {
      return this.$route.params.email || '';
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
    errorMessage(error) {
      const status = error.response?.status;
      if (status === 429) return this.$t('global.errors.tooManyRequests');
      // The server answers 400 for an unknown, expired or used link (and for
      // two different passwords, which the form already prevents).
      if (status === 400) return this.$t('global.errors.passwordLinkExpired');
      return this.$t('global.errors.errorOccured');
    },
    async setPassword() {
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const { $axios, $route, $router } = this;
      this.loading = true;
      try {
        const answer = await $axios.$put(
          apiRoutes.accountSetPassword($route.params),
          this.form
        );
        // The link opens no session for a member who needs a second factor
        // (ADR 0008): they sign in with the new password.
        if (answer && answer.twoFactorRequired) {
          this.showSnackbar({
            text: this.$t('twoFactor.passwordSet'),
            color: 'success',
          });
          return $router.push('/account/login');
        }
        $router.push('/');
      } catch (error) {
        if (error.response?.status === 400) {
          this.linkExpired = true;
          return;
        }
        this.showSnackbar({
          text: this.errorMessage(error),
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
    v-if="linkExpired"
    :title="$t('authCard.linkExpiredTitle')"
    :email="email"
  >
    <template #icon><lucide-link2-off :size="26" /></template>
    <template #description>
      {{ $t('global.errors.passwordLinkExpired') }}
    </template>
    <template #actions>
      <v-btn text color="primary" nuxt to="/account/login">
        {{ $t('authCard.backToLogin') }}
      </v-btn>
      <v-spacer />
      <v-btn color="accent" elevation="0" nuxt to="/account/reset-password">
        {{ $t('authCard.askNewLink') }}
      </v-btn>
    </template>
  </bs-auth-card>

  <bs-auth-card
    v-else
    :title="$t('authCard.setTitle')"
    :email="email"
    :loading="loading"
  >
    <template #icon><lucide-lock :size="26" /></template>
    <template #description>{{ $t('authCard.setIntro') }}</template>
    <v-form id="login-form" method="post" @submit.prevent="setPassword">
      <bs-text-field
        id="password"
        v-model="form.password"
        autofocus
        :label="$t('global.password')"
        name="password"
        autocomplete="new-password"
        :error-messages="passwordErrors"
        :type="showPassword ? 'text' : 'password'"
        required
        :disabled="loading"
      >
        <template #append>
          <v-btn
            icon
            small
            :aria-label="
              showPassword
                ? $t('authCard.hidePassword')
                : $t('authCard.showPassword')
            "
            @click="showPassword = !showPassword"
          >
            <lucide-eye v-if="showPassword" :size="18" />
            <lucide-eye-off v-else :size="18" />
          </v-btn>
        </template>
      </bs-text-field>
      <bs-text-field
        id="passwordConfirm"
        v-model="form.passwordConfirm"
        dense
        :label="$t('forms.user.passwordConfirm')"
        name="passwordConfirm"
        autocomplete="new-password"
        :error-messages="passwordConfirmErrors"
        :type="showPassword ? 'text' : 'password'"
        required
        :disabled="loading"
      />
    </v-form>
    <template #actions>
      <v-btn
        color="accent"
        elevation="0"
        form="login-form"
        type="submit"
        :loading="loading"
      >
        <lucide-check :size="16" class="mr-2" />
        {{ $t('authCard.setSubmit') }}
      </v-btn>
    </template>
  </bs-auth-card>
</template>
